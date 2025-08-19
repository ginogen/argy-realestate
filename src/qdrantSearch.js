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

// Función para estimar total real de propiedades que coinciden
async function estimateTotalResults(queryEmbedding, filters) {
  try {
    // Hacer búsqueda más amplia para estimar total
    const estimationResults = await qdrant.search(COLLECTION_NAME, {
      vector: queryEmbedding,
      limit: 1000, // Muestra más grande para estimación
      with_payload: true,
      score_threshold: 0.02 // Aún más permisivo para estimación
    });
    
    // Aplicar filtros a la muestra amplia
    const filteredEstimation = applyPostSearchFilters(estimationResults, filters);
    const uniqueEstimation = removeDuplicateProperties(filteredEstimation);
    
    // Estimar total basado en la muestra
    // Si obtuvimos 1000 resultados y X pasaron filtros, proyectar al total
    const totalProperties = await getTotalPropertiesCount();
    const estimationRatio = uniqueEstimation.length / Math.min(estimationResults.length, 1000);
    const estimatedTotal = Math.round(totalProperties * estimationRatio * 0.7); // Factor conservador
    
    console.log(`📊 Estimación: ${uniqueEstimation.length}/${estimationResults.length} en muestra → ~${estimatedTotal} total`);
    
    // Retornar al menos lo que encontramos, pero sugerir que hay más
    return Math.max(uniqueEstimation.length, estimatedTotal);
    
  } catch (error) {
    console.error('Error estimando total:', error);
    return 100; // Fallback conservador
  }
}

// Obtener conteo total de propiedades en la colección
async function getTotalPropertiesCount() {
  try {
    const collectionInfo = await qdrant.getCollection(COLLECTION_NAME);
    return collectionInfo.points_count || 3000; // Fallback
  } catch (error) {
    return 3000; // Fallback conocido
  }
}

// Función principal de búsqueda
export async function searchProperties(query, filters = {}, options = {}) {
  try {
    const { offset = 0, limit = 20 } = options;
    
    console.log('🔍 Búsqueda:', { query, filters, offset, limit });
    
    // Generar embedding para la consulta
    const queryEmbedding = await generateQueryEmbedding(query);
    
    // Construir filtros de Qdrant (por ahora sin filtros)
    const qdrantFilter = buildQdrantFilter(filters);
    
    // Realizar búsqueda en Qdrant - obtener muchos más resultados para filtrar después
    const searchLimit = Math.max(500, (limit + offset) * 10);
    const searchResults = await qdrant.search(COLLECTION_NAME, {
      vector: queryEmbedding,
      filter: qdrantFilter,
      limit: searchLimit,
      with_payload: true,
      score_threshold: 0.03 // Umbral más permisivo para mayor cobertura
    });
    
    // Aplicar filtros post-búsqueda manualmente
    let filteredResults = applyPostSearchFilters(searchResults, filters);
    
    // Fallback: si hay muy pocos resultados exactos y se pidieron dormitorios específicos,
    // intentar búsqueda flexible (±1 dormitorio)
    if (filteredResults.length < 5 && filters.bedrooms) {
      console.log(`⚠️ Solo ${filteredResults.length} resultados exactos. Intentando búsqueda flexible...`);
      
      const flexibleFilters = { ...filters };
      // Temporalmente remover filtro exacto de dormitorios para búsqueda flexible
      const originalBedrooms = flexibleFilters.bedrooms;
      delete flexibleFilters.bedrooms;
      
      const flexibleResults = applyPostSearchFilters(searchResults, flexibleFilters)
        .filter(result => {
          const property = result.payload;
          const propertyBedrooms = property.bedrooms || 0;
          // Aceptar ±1 dormitorio solo como fallback
          return propertyBedrooms >= originalBedrooms - 1 && propertyBedrooms <= originalBedrooms + 1;
        });
      
      // Combinar resultados: exactos primero, luego flexibles
      const exactResults = filteredResults;
      const additionalResults = flexibleResults
        .filter(flexResult => !exactResults.some(exactResult => 
          exactResult.payload.originalId === flexResult.payload.originalId))
        .slice(0, Math.max(0, 15 - exactResults.length));
      
      filteredResults = [...exactResults, ...additionalResults];
      
      if (additionalResults.length > 0) {
        console.log(`✅ Agregados ${additionalResults.length} resultados similares (±1 dormitorio)`);
      }
    }
    
    // Eliminar duplicados basados en originalId o título
    const uniqueResults = removeDuplicateProperties(filteredResults);
    
    // Gestión inteligente de conteo total
    let totalEstimated = uniqueResults.length;
    
    if (offset === 0) {
      // Primera página: hacer estimación del total real
      if (uniqueResults.length < searchLimit * 0.8) {
        totalEstimated = await estimateTotalResults(queryEmbedding, filters);
      }
    } else {
      // Páginas siguientes: si no tenemos suficientes resultados, buscar más
      if (uniqueResults.length <= offset + limit) {
        console.log(`📄 Página ${Math.floor(offset/limit)+1}: Buscando más resultados...`);
        
        // Búsqueda expandida para páginas siguientes
        const expandedResults = await qdrant.search(COLLECTION_NAME, {
          vector: queryEmbedding,
          filter: buildQdrantFilter(filters),
          limit: Math.max(1000, offset + limit + 100), // Buscar suficientes para esta página y más
          with_payload: true,
          score_threshold: 0.02
        });
        
        const expandedFiltered = applyPostSearchFilters(expandedResults, filters);
        const expandedUnique = removeDuplicateProperties(expandedFiltered);
        
        // Actualizar resultados con la búsqueda expandida
        const expandedScored = expandedUnique.map(result => ({
          ...result.payload,
          score: result.score,
          relevanceScore: calculateRelevanceScore(result.payload, filters, result.score)
        }));
        
        expandedScored.sort((a, b) => b.relevanceScore - a.relevanceScore);
        
        totalEstimated = expandedScored.length;
        
        // Usar los resultados expandidos para esta paginación
        const expandedPaginated = expandedScored.slice(offset, offset + limit);
        const hasMoreExpanded = expandedScored.length > offset + limit;
        
        console.log(`✅ Búsqueda expandida: ${expandedPaginated.length} propiedades (${totalEstimated} total disponibles)`);
        
        return {
          properties: expandedPaginated,
          total: totalEstimated,
          hasMore: hasMoreExpanded
        };
      } else {
        // Tenemos suficientes resultados en la búsqueda inicial
        totalEstimated = Math.max(uniqueResults.length, offset + limit + 20); // Sugerir que hay más
      }
    }
    
    // Calcular scores de relevancia
    const scoredResults = uniqueResults.map(result => ({
      ...result.payload,
      score: result.score,
      relevanceScore: calculateRelevanceScore(result.payload, filters, result.score)
    }));
    
    // Ordenar por relevancia
    scoredResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    // Aplicar paginación
    const paginatedResults = scoredResults.slice(offset, offset + limit);
    
    // Calcular si hay más resultados disponibles
    const hasMore = (offset + limit < totalEstimated) || (scoredResults.length > offset + limit);
    
    console.log(`✅ Encontradas ${paginatedResults.length} propiedades (${totalEstimated}+ total disponibles)`);
    
    return {
      properties: paginatedResults,
      total: totalEstimated,
      hasMore: hasMore
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

// Aplicar filtros después de la búsqueda semántica
function applyPostSearchFilters(searchResults, filters) {
  if (!filters || Object.keys(filters).length === 0) {
    return searchResults;
  }
  
  return searchResults.filter(result => {
    const property = result.payload;
    
    // Filtro por precio
    if (filters.priceMin && property.price < filters.priceMin) {
      return false;
    }
    if (filters.priceMax && property.price > filters.priceMax) {
      return false;
    }
    
    // Filtro por dormitorios (exacto)
    if (filters.bedrooms && property.bedrooms !== filters.bedrooms) {
      return false;
    }
    
    // Filtro por baños (mínimo)
    if (filters.bathrooms && property.bathrooms < filters.bathrooms) {
      return false;
    }
    
    // Filtro por tipo de propiedad
    if (filters.propertyType) {
      const propertyTypeLower = property.propertyType?.toLowerCase() || '';
      const filterTypeLower = filters.propertyType.toLowerCase();
      
      // Coincidencia flexible para tipos de propiedad
      if (!propertyTypeLower.includes(filterTypeLower) && 
          !filterTypeLower.includes(propertyTypeLower)) {
        return false;
      }
    }
    
    // Filtro por barrio (más flexible)
    if (filters.neighborhood) {
      const neighborhoodLower = property.neighborhood?.toLowerCase() || '';
      const addressLower = property.address?.toLowerCase() || '';
      const cityLower = property.city?.toLowerCase() || '';
      const filterNeighborhood = filters.neighborhood.toLowerCase();
      
      // Buscar coincidencias parciales en barrio, dirección o ciudad
      const hasMatch = neighborhoodLower.includes(filterNeighborhood) || 
                      addressLower.includes(filterNeighborhood) ||
                      cityLower.includes(filterNeighborhood) ||
                      filterNeighborhood.includes(neighborhoodLower) ||
                      // Coincidencias por palabras clave comunes
                      (filterNeighborhood.includes('centro') && (neighborhoodLower.includes('centro') || neighborhoodLower.includes('distrito centro'))) ||
                      (filterNeighborhood.includes('norte') && neighborhoodLower.includes('norte')) ||
                      (filterNeighborhood.includes('sur') && neighborhoodLower.includes('sur'));
      
      if (!hasMatch) {
        return false;
      }
    }
    
    // Filtro por características
    if (filters.hasFeatures && filters.hasFeatures.length > 0) {
      const hasRequiredFeatures = filters.hasFeatures.some(feature => {
        switch (feature) {
          case 'balcony': return property.hasBalcony;
          case 'terrace': return property.hasTerrace;
          case 'garage': return property.garages > 0;
          case 'pool': return property.hasPool;
          case 'garden': return property.hasGarden;
          default: return false;
        }
      });
      
      if (!hasRequiredFeatures) {
        return false;
      }
    }
    
    // Excluir propiedades reservadas por defecto
    if (property.reserved) {
      return false;
    }
    
    return true;
  });
}

// Eliminar propiedades duplicadas (menos agresivo)
function removeDuplicateProperties(results) {
  const seen = new Set();
  const unique = [];
  
  for (const result of results) {
    const property = result.payload;
    
    // Usar solo originalId como clave principal para duplicados
    const originalId = property.originalId;
    
    // Solo eliminar si el originalId ya fue visto
    if (originalId && seen.has(originalId)) {
      continue;
    }
    
    // Marcar como visto solo por originalId
    if (originalId) {
      seen.add(originalId);
    }
    
    unique.push(result);
  }
  
  console.log(`🔄 Eliminados ${results.length - unique.length} duplicados de ${results.length} resultados`);
  return unique;
}

// Calcular score de relevancia personalizado
function calculateRelevanceScore(property, filters, vectorScore) {
  let score = vectorScore * 100; // Base score del embedding
  
  // Boost por coincidencias exactas de dormitorios
  if (filters.bedrooms && property.bedrooms === filters.bedrooms) {
    score += 25; // Boost por coincidencia exacta
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