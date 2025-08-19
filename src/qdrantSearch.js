// qdrantSearch.js - Búsqueda híbrida en Qdrant
import { QdrantClient } from '@qdrant/js-client-rest';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const COLLECTION_NAME = 'properties';

// Clientes
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL || 'http://localhost:6333',
  apiKey: process.env.QDRANT_API_KEY
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Función principal de búsqueda
export async function searchProperties(query, filters = {}, options = {}) {
  try {
    const { offset = 0, limit = 10 } = options;
    
    console.log('🔍 Búsqueda:', { query, filters, offset, limit });
    
    // Generar embedding para la consulta
    const queryEmbedding = await generateQueryEmbedding(query);
    
    // Construir filtros de Qdrant
    const qdrantFilter = buildQdrantFilter(filters);
    
    // Realizar búsqueda en Qdrant
    const searchResults = await qdrant.search(COLLECTION_NAME, {
      vector: queryEmbedding,
      filter: qdrantFilter,
      limit: limit + offset, // Obtener más para hacer offset
      with_payload: true,
      score_threshold: 0.1 // Umbral mínimo de similitud
    });
    
    // Aplicar offset manualmente (Qdrant no tiene offset nativo en search)
    const paginatedResults = searchResults.slice(offset, offset + limit);
    
    // Procesar y rankear resultados
    const processedProperties = paginatedResults.map(result => ({
      ...result.payload,
      score: result.score,
      relevanceScore: calculateRelevanceScore(result.payload, filters, result.score)
    }));
    
    // Ordenar por relevancia
    processedProperties.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    console.log(`✅ Encontradas ${processedProperties.length} propiedades`);
    
    return {
      properties: processedProperties,
      total: searchResults.length,
      hasMore: searchResults.length > offset + limit
    };
    
  } catch (error) {
    console.error('❌ Error en búsqueda Qdrant:', error);
    throw error;
  }
}

// Generar embedding para consulta
async function generateQueryEmbedding(query) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generando embedding:', error);
    throw error;
  }
}

// Construir filtros de Qdrant
function buildQdrantFilter(filters) {
  const conditions = [];
  
  // Filtro por precio
  if (filters.priceMin || filters.priceMax) {
    const priceCondition = {
      key: 'price',
      range: {}
    };
    
    if (filters.priceMin) priceCondition.range.gte = filters.priceMin;
    if (filters.priceMax) priceCondition.range.lte = filters.priceMax;
    
    conditions.push(priceCondition);
  }
  
  // Filtro por dormitorios
  if (filters.bedrooms) {
    conditions.push({
      key: 'bedrooms',
      match: { value: filters.bedrooms }
    });
  }
  
  // Filtro por baños
  if (filters.bathrooms) {
    conditions.push({
      key: 'bathrooms',
      range: { gte: filters.bathrooms }
    });
  }
  
  // Filtro por tipo de propiedad
  if (filters.propertyType) {
    conditions.push({
      key: 'propertyType',
      match: { value: filters.propertyType }
    });
  }
  
  // Filtro por barrio (búsqueda parcial)
  if (filters.neighborhood) {
    conditions.push({
      key: 'neighborhood',
      match: { 
        text: filters.neighborhood.toLowerCase()
      }
    });
  }
  
  // Filtros por características específicas
  if (filters.hasFeatures && filters.hasFeatures.length > 0) {
    const featureConditions = [];
    
    filters.hasFeatures.forEach(feature => {
      switch (feature) {
        case 'balcony':
          featureConditions.push({
            key: 'hasBalcony',
            match: { value: true }
          });
          break;
        case 'terrace':
          featureConditions.push({
            key: 'hasTerrace',
            match: { value: true }
          });
          break;
        case 'garage':
          featureConditions.push({
            key: 'garages',
            range: { gte: 1 }
          });
          break;
        case 'pool':
          featureConditions.push({
            key: 'hasPool',
            match: { value: true }
          });
          break;
        case 'garden':
          featureConditions.push({
            key: 'hasGarden',
            match: { value: true }
          });
          break;
      }
    });
    
    // Usar OR para características (any feature matches)
    if (featureConditions.length > 0) {
      conditions.push({
        should: featureConditions
      });
    }
  }
  
  // Filtro por superficie
  if (filters.areaMin || filters.areaMax) {
    const areaCondition = {
      key: 'totalArea',
      range: {}
    };
    
    if (filters.areaMin) areaCondition.range.gte = filters.areaMin;
    if (filters.areaMax) areaCondition.range.lte = filters.areaMax;
    
    conditions.push(areaCondition);
  }
  
  // Excluir propiedades reservadas por defecto
  conditions.push({
    key: 'reserved',
    match: { value: false }
  });
  
  if (conditions.length === 0) {
    return undefined;
  }
  
  return {
    must: conditions
  };
}

// Calcular score de relevancia personalizado
function calculateRelevanceScore(property, filters, vectorScore) {
  let score = vectorScore * 100; // Base score del embedding
  
  // Boost por coincidencias exactas
  if (filters.bedrooms && property.bedrooms === filters.bedrooms) {
    score += 20;
  }
  
  if (filters.propertyType && property.propertyType === filters.propertyType) {
    score += 15;
  }
  
  // Boost por precio en rango preferido
  if (filters.priceMax && property.price <= filters.priceMax * 0.8) {
    score += 10; // Boost por estar muy por debajo del máximo
  }
  
  // Boost por características deseadas
  if (filters.hasFeatures) {
    let featureMatches = 0;
    
    filters.hasFeatures.forEach(feature => {
      switch (feature) {
        case 'balcony':
          if (property.hasBalcony) featureMatches++;
          break;
        case 'terrace':
          if (property.hasTerrace) featureMatches++;
          break;
        case 'garage':
          if (property.garages > 0) featureMatches++;
          break;
        case 'pool':
          if (property.hasPool) featureMatches++;
          break;
        case 'garden':
          if (property.hasGarden) featureMatches++;
          break;
      }
    });
    
    score += featureMatches * 5; // 5 puntos por característica matched
  }
  
  // Penalizar propiedades sin fotos
  if (property.photosCount === 0) {
    score -= 5;
  }
  
  // Boost por área generosa (más de 80m²)
  if (property.totalArea > 80) {
    score += 3;
  }
  
  // Boost por inmobiliarias premium
  if (property.publisher && property.publisher.length > 0) {
    score += 2;
  }
  
  return Math.max(0, score); // Asegurar que no sea negativo
}

// Búsqueda por ID específico (ahora numérico)
export async function getPropertyById(propertyId) {
  try {
    const result = await qdrant.retrieve(COLLECTION_NAME, {
      ids: [parseInt(propertyId)],
      with_payload: true
    });
    
    return result.length > 0 ? result[0].payload : null;
  } catch (error) {
    console.error('Error obteniendo propiedad por ID:', error);
    throw error;
  }
}

// Búsqueda por ID original de Zonaprop
export async function getPropertyByOriginalId(originalId) {
  try {
    const result = await qdrant.scroll(COLLECTION_NAME, {
      filter: {
        must: [
          {
            key: 'originalId',
            match: { value: originalId }
          }
        ]
      },
      limit: 1,
      with_payload: true
    });
    
    return result.points.length > 0 ? result.points[0].payload : null;
  } catch (error) {
    console.error('Error obteniendo propiedad por ID original:', error);
    throw error;
  }
}

// Búsqueda de propiedades similares
export async function findSimilarProperties(propertyId, limit = 5) {
  try {
    // Obtener la propiedad base
    const baseProperty = await getPropertyById(propertyId);
    if (!baseProperty) {
      throw new Error('Propiedad no encontrada');
    }
    
    // Buscar propiedades similares
    const results = await searchProperties(
      baseProperty.embeddingText,
      {
        propertyType: baseProperty.propertyType,
        priceMin: Math.max(0, baseProperty.price * 0.7),
        priceMax: baseProperty.price * 1.3,
        bedrooms: baseProperty.bedrooms
      },
      { limit: limit + 1 } // +1 para excluir la misma propiedad
    );
    
    // Filtrar la propiedad original
    return results.properties.filter(p => p.id !== propertyId).slice(0, limit);
    
  } catch (error) {
    console.error('Error buscando propiedades similares:', error);
    throw error;
  }
}

// Obtener estadísticas de la colección
export async function getCollectionStats() {
  try {
    const info = await qdrant.getCollection(COLLECTION_NAME);
    return {
      totalProperties: info.points_count,
      status: info.status,
      vectorSize: info.config.params.vectors.size
    };
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    throw error;
  }
}