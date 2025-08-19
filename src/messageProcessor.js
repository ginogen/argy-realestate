// messageProcessor.js - Procesador de mensajes con GPT-4 y búsqueda en Qdrant
import OpenAI from 'openai';
import { searchProperties } from './qdrantSearch.js';
import { formatPropertyList, formatPropertyDetails } from './responseFormatter.js';
import { sendPropertyImage } from './imageHandler.js';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Función principal para procesar mensajes
export async function processMessage(message, session) {
  try {
    console.log(`🤖 Procesando mensaje: "${message}"`);
    
    // Detectar tipo de mensaje
    const messageType = detectMessageType(message, session);
    
    switch (messageType) {
      case 'greeting':
        return handleGreeting();
      
      case 'property_detail':
        return await handlePropertyDetail(message, session);
      
      case 'photo_request':
        return await handlePhotoRequest(message, session);
      
      case 'more_results':
        return await handleMoreResults(session);
      
      case 'property_search':
        return await handlePropertySearch(message, session);
      
      case 'help':
        return handleHelp();
      
      default:
        return await handlePropertySearch(message, session);
    }
    
  } catch (error) {
    console.error('❌ Error procesando mensaje:', error);
    return {
      text: '❌ Lo siento, ocurrió un error procesando tu consulta. Por favor, intenta de nuevo.',
      context: session.context
    };
  }
}

// Detectar tipo de mensaje
function detectMessageType(message, session) {
  const lowerMessage = message.toLowerCase().trim();
  
  // Saludos
  if (/^(hola|hi|hello|buenos días|buenas tardes|buenas noches|hey)$/i.test(lowerMessage)) {
    return 'greeting';
  }
  
  // Ayuda
  if (/ayuda|help|como usar|instrucciones/i.test(lowerMessage)) {
    return 'help';
  }
  
  // Más resultados
  if (/^(más|mas|more|ver más|siguiente|next)$/i.test(lowerMessage)) {
    return 'more_results';
  }
  
  // Solicitud de foto
  if (/foto|imagen|picture|pic|ver foto/i.test(lowerMessage)) {
    return 'photo_request';
  }
  
  // Número de propiedad (1-10) - hacer más flexible
  if (/^[1-9]$|^10$/.test(lowerMessage)) {
    // Verificar si hay resultados previos en la sesión
    if (session.lastResults?.length > 0) {
      return 'property_detail';
    }
    // Si el usuario escribió solo un número pero no hay resultados previos,
    // podría estar buscando propiedades con ese número de dormitorios
    return 'property_search';
  }
  
  // Por defecto, búsqueda de propiedades
  return 'property_search';
}

// Manejar saludo
function handleGreeting() {
  return {
    text: `¡Hola! 👋 Soy tu asistente de propiedades en Rosario.

🏠 Puedo ayudarte a encontrar:
• Departamentos y casas en alquiler
• Filtrar por precio, zona, dormitorios
• Mostrar detalles completos

💬 Ejemplos de búsquedas:
• "Departamento 2 dormitorios en Centro hasta 400 mil"
• "Casa con jardín en zona norte"
• "Algo económico cerca del centro"

¿Qué tipo de propiedad estás buscando?`,
    context: {}
  };
}

// Manejar ayuda
function handleHelp() {
  return {
    text: `🤖 *Guía de uso del bot*

📝 *Cómo buscar:*
• Escribe de forma natural lo que buscas
• Puedes especificar: tipo, zona, precio, dormitorios

🔍 *Ejemplos de búsquedas:*
• "Depto 2 dormitorios Centro hasta 350 mil"
• "Casa con cochera zona norte"
• "Algo con balcón cerca del Parque España"
• "Departamentos baratos"

📊 *Después de una búsqueda:*
• Escribe el número (1-10) para ver detalles
• Escribe "más" para ver más resultados
• Haz una nueva búsqueda para refinar

¿En qué puedo ayudarte?`,
    context: {}
  };
}

// Manejar detalles de propiedad específica
async function handlePropertyDetail(message, session) {
  const propertyIndex = parseInt(message) - 1;
  const properties = session.lastResults || [];
  
  console.log(`🔍 Solicitando detalles de propiedad #${message}, índice: ${propertyIndex}`);
  console.log(`📋 Propiedades disponibles: ${properties.length}`);
  
  if (propertyIndex < 0 || propertyIndex >= properties.length) {
    return {
      text: `❌ Número inválido. Elige un número del 1 al ${properties.length}.
      
🔍 Para ver detalles de una propiedad:
• Primero busca propiedades 
• Luego escribe el número (1-${Math.min(10, properties.length)})`,
      context: session.context
    };
  }
  
  const property = properties[propertyIndex];
  
  console.log(`✅ Mostrando detalles de: ${property.title || property.propertyType}`);
  
  return {
    text: formatPropertyDetails(property),
    sendImage: property.photos?.length > 0, // Flag para enviar imagen
    property: property, // Para enviar imagen después
    context: {
      ...session.context,
      lastSelectedProperty: property
    }
  };
}

// Manejar solicitud de fotos
async function handlePhotoRequest(message, session) {
  const lowerMessage = message.toLowerCase();
  
  // Si especifica número: "foto 3"
  const numberMatch = lowerMessage.match(/(\d+)/);
  
  if (numberMatch && session.lastResults) {
    const propertyIndex = parseInt(numberMatch[1]) - 1;
    
    if (propertyIndex >= 0 && propertyIndex < session.lastResults.length) {
      const property = session.lastResults[propertyIndex];
      
      if (property.photos && property.photos.length > 0) {
        return {
          text: `📸 Enviando foto de: ${property.title}`,
          sendImage: true,
          property: property,
          context: session.context
        };
      } else {
        return {
          text: `❌ La propiedad "${property.title}" no tiene fotos disponibles.`,
          context: session.context
        };
      }
    }
  }
  
  // Si pidió foto de la última propiedad seleccionada
  if (session.lastSelectedProperty) {
    const property = session.lastSelectedProperty;
    
    if (property.photos && property.photos.length > 0) {
      return {
        text: `📸 Enviando foto de: ${property.title}`,
        sendImage: true,
        property: property,
        context: session.context
      };
    } else {
      return {
        text: `❌ Esta propiedad no tiene fotos disponibles.`,
        context: session.context
      };
    }
  }
  
  return {
    text: `📸 Para ver fotos:\n• Primero busca propiedades\n• Luego escribe "foto [número]"\n• Ejemplo: "foto 3"`,
    context: session.context
  };
}

// Manejar "ver más resultados"
async function handleMoreResults(session) {
  if (!session.lastQuery) {
    return {
      text: '❌ No hay búsqueda previa. Por favor, realiza una nueva consulta.',
      context: session.context
    };
  }
  
  // Incrementar offset para siguiente página
  const offset = (session.currentOffset || 0) + 10;
  
  try {
    const results = await searchProperties(
      session.lastQuery, 
      session.lastFilters,
      { offset, limit: 10 }
    );
    
    if (results.properties.length === 0) {
      return {
        text: '📄 No hay más resultados disponibles para tu búsqueda.',
        context: session.context
      };
    }
    
    return {
      text: formatPropertyList(results.properties, `📄 Más resultados (${offset + 1}-${offset + results.properties.length}):`),
      properties: results.properties,
      context: {
        ...session.context,
        lastResults: results.properties,
        currentOffset: offset
      }
    };
    
  } catch (error) {
    console.error('Error obteniendo más resultados:', error);
    return {
      text: '❌ Error obteniendo más resultados. Intenta de nuevo.',
      context: session.context
    };
  }
}

// Manejar búsqueda de propiedades
async function handlePropertySearch(message, session) {
  try {
    // Usar GPT-4 para extraer intención y parámetros
    const searchIntent = await extractSearchIntent(message, session.context);
    
    // Buscar en Qdrant
    const results = await searchProperties(
      searchIntent.query,
      searchIntent.filters,
      { offset: 0, limit: 10 }
    );
    
    if (results.properties.length === 0) {
      return {
        text: `🔍 No encontré propiedades que coincidan con: "${message}"

💡 *Sugerencias:*
• Prueba con criterios más amplios
• Verifica la zona solicitada
• Ajusta el rango de precios

¿Quieres buscar algo diferente?`,
        context: {
          ...session.context,
          lastQuery: searchIntent.query,
          lastFilters: searchIntent.filters
        }
      };
    }
    
    // Crear mensaje de resumen
    const summary = createSearchSummary(searchIntent, results);
    const formattedList = formatPropertyList(results.properties);
    
    return {
      text: `${summary}\n\n${formattedList}`,
      properties: results.properties,
      context: {
        ...session.context,
        lastQuery: searchIntent.query,
        lastFilters: searchIntent.filters,
        lastResults: results.properties,
        currentOffset: 0
      }
    };
    
  } catch (error) {
    console.error('Error en búsqueda:', error);
    return {
      text: '❌ Error realizando la búsqueda. Por favor, intenta de nuevo.',
      context: session.context
    };
  }
}

// Extraer intención de búsqueda usando GPT-4
async function extractSearchIntent(message, context = {}) {
  const systemPrompt = `Eres un asistente que extrae parámetros de búsqueda de propiedades en Rosario, Argentina.

Analiza el mensaje del usuario y extrae:
- Tipo de consulta (search query para embedding)
- Filtros específicos para búsqueda

Responde SOLO en JSON con esta estructura:
{
  "query": "texto optimizado para búsqueda semántica",
  "filters": {
    "priceMin": number o null,
    "priceMax": number o null,
    "bedrooms": number o null,
    "bathrooms": number o null,
    "propertyType": "string" o null,
    "neighborhood": "string" o null,
    "hasFeatures": ["balcony", "terrace", "garage", "pool"] o []
  }
}

Contexto de búsqueda previa: ${JSON.stringify(context)}

Ejemplos:
- "depto 2 dormitorios centro hasta 400mil" → {"query": "departamento centro", "filters": {"priceMax": 400000, "bedrooms": 2, "propertyType": "Departamento"}}
- "casa con jardín zona norte" → {"query": "casa jardín zona norte", "filters": {"propertyType": "Casa", "hasFeatures": ["garden"]}}
- "algo económico" → {"query": "propiedad económica", "filters": {"priceMax": 300000}}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      temperature: 0.1,
      max_tokens: 300
    });
    
    const response = completion.choices[0].message.content.trim();
    return JSON.parse(response);
    
  } catch (error) {
    console.error('Error extrayendo intención:', error);
    
    // Fallback: extracción básica
    return {
      query: message,
      filters: extractBasicFilters(message)
    };
  }
}

// Extracción básica de filtros como fallback
function extractBasicFilters(message) {
  const filters = {};
  const lowerMessage = message.toLowerCase();
  
  // Precios
  const priceMatch = lowerMessage.match(/(\d+)[\s]*mil|(\d+)[\s]*k|(\d+)[\s]*pesos/);
  if (priceMatch) {
    const amount = parseInt(priceMatch[1] || priceMatch[2] || priceMatch[3]) * 1000;
    if (lowerMessage.includes('hasta') || lowerMessage.includes('máximo')) {
      filters.priceMax = amount;
    } else if (lowerMessage.includes('desde') || lowerMessage.includes('mínimo')) {
      filters.priceMin = amount;
    } else {
      filters.priceMax = amount;
    }
  }
  
  // Dormitorios
  const bedroomsMatch = lowerMessage.match(/(\d+)[\s]*(dormitorio|habitación|ambiente)/);
  if (bedroomsMatch) {
    filters.bedrooms = parseInt(bedroomsMatch[1]);
  }
  
  // Tipo de propiedad
  if (lowerMessage.includes('departamento') || lowerMessage.includes('depto')) {
    filters.propertyType = 'Departamento';
  } else if (lowerMessage.includes('casa')) {
    filters.propertyType = 'Casa';
  }
  
  // Características
  const features = [];
  if (lowerMessage.includes('balcón')) features.push('balcony');
  if (lowerMessage.includes('terraza')) features.push('terrace');
  if (lowerMessage.includes('cochera') || lowerMessage.includes('garage')) features.push('garage');
  if (lowerMessage.includes('pileta') || lowerMessage.includes('piscina')) features.push('pool');
  if (lowerMessage.includes('jardín')) features.push('garden');
  
  if (features.length > 0) {
    filters.hasFeatures = features;
  }
  
  return filters;
}

// Crear resumen de búsqueda
function createSearchSummary(searchIntent, results) {
  const { filters } = searchIntent;
  const count = results.properties.length;
  
  let summary = `🔍 Encontré ${count} ${count === 1 ? 'propiedad' : 'propiedades'}`;
  
  const criteria = [];
  if (filters.propertyType) criteria.push(filters.propertyType.toLowerCase());
  if (filters.bedrooms) criteria.push(`${filters.bedrooms} dormitorios`);
  if (filters.priceMax) criteria.push(`hasta $${filters.priceMax.toLocaleString('es-AR')}`);
  if (filters.neighborhood) criteria.push(`en ${filters.neighborhood}`);
  
  if (criteria.length > 0) {
    summary += ` que coincide${count === 1 ? '' : 'n'} con: ${criteria.join(', ')}`;
  }
  
  return summary;
}