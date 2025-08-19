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

// Construir filtros de Qdrant - temporalmente sin filtros hasta crear índices
function buildQdrantFilter(filters) {
  // Por ahora, no usar filtros de Qdrant hasta que se configuren los índices
  // Solo usar búsqueda semántica
  return undefined;
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