// messageProcessor.js - Procesador de mensajes con GPT-4 y búsqueda en Qdrant
import OpenAI from 'openai';
import { searchProperties } from './qdrantSearch.js';
import { formatPropertyList, formatPropertyDetails } from './responseFormatter.js';
import { sendPropertyImage } from './imageHandler.js';
import { saveUserSearchHistory, learnFromUserBehavior } from './userManager.js';
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
      
      case 'favorites':
        return await handleFavorites(session);
      
      case 'search_history':
        return await handleSearchHistory(session);
      
      case 'preferences':
        return await handlePreferences(session);
      
      case 'save_property':
        return await handleSaveProperty(message, session);
      
      case 'recommended_search':
        return await handleRecommendedSearch(session);
      
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
  
  console.log(`🔍 Detectando tipo de mensaje: "${message}"`);
  console.log(`📊 Sesión tiene ${session?.lastResults?.length || 0} resultados previos`);
  
  // Debug: mostrar qué regex está siendo evaluada
  const debugChecks = [];
  
  // Saludos
  if (/^(hola|hi|hello|buenos días|buenas tardes|buenas noches|hey)$/i.test(lowerMessage)) {
    debugChecks.push('greeting: MATCH');
    console.log(`🎯 Tipo detectado: greeting`);
    return 'greeting';
  }
  debugChecks.push('greeting: no match');
  
  // Ayuda y menú
  if (/ayuda|help|como usar|instrucciones|menu|menú/i.test(lowerMessage)) {
    debugChecks.push('help: MATCH');
    console.log(`🎯 Tipo detectado: help`);
    return 'help';
  }
  debugChecks.push('help: no match');
  
  // Comandos de usuario
  if (/favoritos|guardadas|mis propiedades|saved/i.test(lowerMessage)) {
    debugChecks.push('favorites: MATCH');
    console.log(`🎯 Tipo detectado: favorites`);
    return 'favorites';
  }
  debugChecks.push('favorites: no match');
  
  if (/historial|mis búsquedas|búsquedas anteriores|history/i.test(lowerMessage)) {
    debugChecks.push('search_history: MATCH');
    console.log(`🎯 Tipo detectado: search_history`);
    return 'search_history';
  }
  debugChecks.push('search_history: no match');
  
  if (/preferencias|configuración|config|settings/i.test(lowerMessage)) {
    debugChecks.push('preferences: MATCH');
    console.log(`🎯 Tipo detectado: preferences`);
    return 'preferences';
  }
  debugChecks.push('preferences: no match');
  
  // Búsqueda recomendada basada en preferencias
  if (/recomendado|recomendación|sugerido|basado en mis gustos/i.test(lowerMessage)) {
    debugChecks.push('recommended: MATCH');
    console.log(`🎯 Tipo detectado: recommended_search`);
    return 'recommended_search';
  }
  debugChecks.push('recommended: no match');
  
  if (/guardar|favorito|save/i.test(lowerMessage) && /[0-9]/.test(lowerMessage)) {
    debugChecks.push('save_property: MATCH');
    console.log(`🎯 Tipo detectado: save_property`);
    return 'save_property';
  }
  debugChecks.push('save_property: no match');
  
  // Más resultados
  if (/^(más|mas|more|ver más|siguiente|next)$/i.test(lowerMessage)) {
    debugChecks.push('more_results: MATCH');
    console.log(`🎯 Tipo detectado: more_results`);
    return 'more_results';
  }
  debugChecks.push('more_results: no match');
  
  // Solicitud de foto
  if (/\bfoto\b|\bimagen\b|\bpicture\b|\bpic\b|ver foto/i.test(lowerMessage)) {
    debugChecks.push('photo_request: MATCH');
    console.log(`🎯 Tipo detectado: photo_request`);
    return 'photo_request';
  }
  debugChecks.push('photo_request: no match');
  
  // Número de propiedad (1-20) - PRIORIDAD ALTA si hay resultados previos
  if (/^([1-9]|1[0-9]|20)$/.test(lowerMessage)) {
    debugChecks.push('property_number: MATCH');
    // Verificar si hay resultados previos en la sesión
    if (session && session.lastResults && session.lastResults.length > 0) {
      console.log(`✅ Detectado número con resultados previos - es selección de propiedad`);
      console.log(`🎯 Tipo detectado: property_detail`);
      return 'property_detail';
    }
    console.log(`❌ Número sin resultados previos - tratando como búsqueda`);
    console.log(`🎯 Tipo detectado: property_search (número sin contexto)`);
    // Si el usuario escribió solo un número pero no hay resultados previos,
    // podría estar buscando propiedades con ese número de dormitorios
    return 'property_search';
  }
  debugChecks.push('property_number: no match');
  
  // Por defecto, búsqueda de propiedades
  console.log(`🔍 Debug checks: ${debugChecks.join(', ')}`);
  console.log(`🎯 Tipo detectado: property_search (default)`);
  return 'property_search';
}

// Manejar saludo
function handleGreeting() {
  return {
    text: `¡Hola! 👋 Soy Airi.

🏠 **¿Qué tipo de propiedad estas buscando?**

📝 **Comandos principales:**
• Escribe tu búsqueda (ej: "depto 2 dorm centro")
• \`favoritos\` - Ver propiedades guardadas
• \`historial\` - Ver búsquedas anteriores  
• \`preferencias\` - Ver tus gustos guardados
• \`ayuda\` - Ver menú completo

💬 **Ejemplos de búsquedas:**
• "Departamento 2 dormitorios en Centro hasta 400 mil"
• "Casa con jardín en zona norte"  
• "Algo económico cerca del centro"

✨ **Después de buscar podrás:**
• Ver detalles: escribe el número (1-20)
• Ver fotos: "foto [número]"
• Guardar: "guardar [número]"
• Más resultados: "más"

¿Qué tipo de propiedad estás buscando?`,
    context: {}
  };
}

// Manejar ayuda
function handleHelp() {
  return {
    text: `🤖 **MENÚ PRINCIPAL - Asistente de Propiedades**

📋 **COMANDOS DISPONIBLES:**

🔍 **BÚSQUEDAS:**
• Escribe natural: "depto 2 dorm centro hasta 400mil"
• \`más\` - Ver más resultados de tu última búsqueda

📂 **TUS DATOS:**
• \`favoritos\` - Ver propiedades que guardaste
• \`historial\` - Ver tus búsquedas anteriores
• \`preferencias\` - Ver gustos que aprendí de ti

✨ **ACCIONES CON RESULTADOS:**
• Número (1-20) - Ver detalles de una propiedad
• \`foto [número]\` - Ver foto específica (ej: "foto 5")
• \`guardar [número]\` - Guardar como favorita

📱 **NAVEGACIÓN:**
• \`hola\` - Volver al inicio  
• \`ayuda\` o \`menú\` - Ver este menú
• Nueva búsqueda - Escribir lo que buscas

🏠 **EJEMPLOS DE BÚSQUEDA:**
• "Departamento 2 dormitorios Centro hasta 400 mil"
• "Casa con jardín zona norte"
• "Algo económico Pichincha"
• "3 dormitorios con balcón"

💡 **TIPS:**
• Sé específico con ubicación y precio
• Puedo recordar tus búsquedas y preferencias  
• Usa números para navegar rápido

¿Qué quieres hacer?`,
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
• Luego escribe el número (1-${Math.min(20, properties.length)})`,
      context: session.context
    };
  }
  
  const property = properties[propertyIndex];
  
  console.log(`✅ Mostrando detalles de: ${property.title || property.propertyType}`);
  console.log(`📸 Propiedad tiene ${property.photos?.length || 0} fotos`);
  console.log(`🔍 Primera foto: ${property.photos?.[0]?.substring(0, 50) || 'Sin fotos'}`);
  
  const shouldSendImage = property.photos && property.photos.length > 0;
  console.log(`📤 Enviar imagen: ${shouldSendImage}`);
  
  return {
    text: formatPropertyDetails(property),
    sendImage: shouldSendImage, // Flag para enviar imagen
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
  const offset = (session.currentOffset || 0) + 20;
  
  try {
    const results = await searchProperties(
      session.lastQuery, 
      session.lastFilters,
      { offset, limit: 20 }
    );
    
    if (results.properties.length === 0) {
      return {
        text: '📄 No hay más resultados disponibles para tu búsqueda.',
        context: session.context
      };
    }
    
    return {
      text: formatPropertyList(results.properties, `📄 Más resultados (${offset + 1}-${offset + results.properties.length}):`, results.total, results.hasMore),
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
      { offset: 0, limit: 20 }
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
    const formattedList = formatPropertyList(results.properties, '🏠 *Propiedades encontradas:*', results.total, results.hasMore);
    
    // Actualizar la sesión con los resultados
    session.lastResults = results.properties;
    session.lastQuery = searchIntent.query;
    session.lastFilters = searchIntent.filters;
    session.currentOffset = 0;
    
    // Guardar búsqueda en historial persistente
    if (session.user?.whatsapp_number) {
      await saveUserSearchHistory(
        session.user.whatsapp_number, 
        searchIntent.query, 
        searchIntent.filters, 
        results.properties.length
      );
      
      // Aprender de los filtros de búsqueda
      await learnFromUserBehavior(session.user.whatsapp_number, searchIntent.filters);
    }
    
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

// === NUEVAS FUNCIONES PARA DATOS PERSISTENTES ===

// Manejar comando "favoritos"
async function handleFavorites(session) {
  if (!session.user?.whatsapp_number) {
    return {
      text: '❌ Error accediendo a tus datos. Intenta de nuevo.',
      context: session.context
    };
  }

  const { getUserFavoritesData } = await import('./userManager.js');
  const favorites = await getUserFavoritesData(session.user.whatsapp_number);

  if (!favorites || favorites.length === 0) {
    return {
      text: `📁 No tienes propiedades guardadas como favoritas.

💡 **Para guardar propiedades:**
• Primero busca propiedades
• Luego escribe "guardar [número]" 

📱 **¿Qué quieres hacer?**
• Buscar propiedades: escribe tu búsqueda
• Menú principal: "ayuda"`,
      context: session.context
    };
  }

  let message = `⭐ **TUS PROPIEDADES FAVORITAS:**\n\n`;

  favorites.forEach((fav, index) => {
    const number = index + 1;
    message += `${number}️⃣ ${fav.property_title || 'Propiedad'}\n`;
    if (fav.property_price) {
      message += `💰 ${fav.property_price}\n`;
    }
    message += `📅 Guardada: ${new Date(fav.saved_at).toLocaleDateString('es-AR')}\n\n`;
  });

  message += `💡 Total: ${favorites.length} propiedad${favorites.length > 1 ? 'es' : ''} guardada${favorites.length > 1 ? 's' : ''}`;
  
  message += `\n\n📱 **OPCIONES:**\n`;
  message += `• Ver detalles: escribe "propiedad [id]"\n`;
  message += `• Nueva búsqueda: escribe lo que buscas\n`;
  message += `• Menú: "ayuda"`;

  return {
    text: message,
    context: session.context
  };
}

// Manejar comando "historial"
async function handleSearchHistory(session) {
  if (!session.user?.whatsapp_number) {
    return {
      text: '❌ Error accediendo a tu historial. Intenta de nuevo.',
      context: session.context
    };
  }

  const { getUserSearchHistory } = await import('./userManager.js');
  const history = await getUserSearchHistory(session.user.whatsapp_number, 10);

  if (!history || history.length === 0) {
    return {
      text: `📋 No tienes búsquedas anteriores.

💡 **Para crear historial:**
• Realiza búsquedas de propiedades
• Se guardarán automáticamente aquí

📱 **¿Qué quieres hacer?**
• Buscar propiedades: escribe tu búsqueda
• Menú principal: "ayuda"`,
      context: session.context
    };
  }

  let message = `📋 **TU HISTORIAL DE BÚSQUEDAS:**\n\n`;

  history.forEach((search, index) => {
    const number = index + 1;
    const date = new Date(search.created_at).toLocaleDateString('es-AR');
    
    message += `${number}️⃣ "${search.query}"\n`;
    message += `📅 ${date} • ${search.results_count} resultado${search.results_count !== 1 ? 's' : ''}\n`;
    
    // Mostrar filtros principales
    if (search.filters) {
      const filters = [];
      if (search.filters.propertyType) filters.push(search.filters.propertyType);
      if (search.filters.bedrooms) filters.push(`${search.filters.bedrooms} dorm.`);
      if (search.filters.priceMax) filters.push(`hasta $${search.filters.priceMax.toLocaleString('es-AR')}`);
      if (search.filters.neighborhood) filters.push(search.filters.neighborhood);
      
      if (filters.length > 0) {
        message += `🔍 ${filters.join(', ')}\n`;
      }
    }
    message += `\n`;
  });

  message += `📱 **OPCIONES:**\n`;
  message += `• Repetir búsqueda: copia y pega una consulta anterior\n`;
  message += `• Nueva búsqueda: escribe lo que buscas\n`;
  message += `• Menú: "ayuda"`;

  return {
    text: message,
    context: session.context
  };
}

// Manejar comando "preferencias"
async function handlePreferences(session) {
  if (!session.user?.whatsapp_number) {
    return {
      text: '❌ Error accediendo a tus preferencias. Intenta de nuevo.',
      context: session.context
    };
  }

  const { getUserPreferencesData } = await import('./userManager.js');
  const preferences = await getUserPreferencesData(session.user.whatsapp_number);

  let message = `⚙️ **TUS PREFERENCIAS GUARDADAS:**\n\n`;

  if (!preferences) {
    message += `📝 Aún no tienes preferencias guardadas.\n\n`;
    message += `💡 **¿Cómo funciona el aprendizaje automático?**\n`;
    message += `• Tipo de propiedad más buscado\n`;
    message += `• Precio máximo preferido\n`;
    message += `• Cantidad de dormitorios usual\n`;
    message += `• Barrios de interés\n\n`;
    message += `🔍 Realiza algunas búsquedas y el sistema aprenderá tus gustos.`;
  } else {
    if (preferences.property_type) {
      message += `🏠 Tipo preferido: ${preferences.property_type}\n`;
    }
    if (preferences.bedrooms) {
      message += `🛏️ Dormitorios: ${preferences.bedrooms}\n`;
    }
    if (preferences.max_price) {
      message += `💰 Precio máximo: $${preferences.max_price.toLocaleString('es-AR')}\n`;
    }
    if (preferences.neighborhoods) {
      try {
        const neighborhoods = JSON.parse(preferences.neighborhoods);
        if (neighborhoods.length > 0) {
          message += `📍 Barrios de interés: ${neighborhoods.join(', ')}\n`;
        }
      } catch (error) {
        // Ignorar error de parsing
      }
    }
    
    message += `\n📅 Última actualización: ${new Date(preferences.updated_at).toLocaleDateString('es-AR')}\n\n`;
    message += `💡 Estas preferencias se usan para mejorar tus búsquedas automáticamente.`;
  }
  
  message += `\n\n📱 **OPCIONES:**\n`;
  message += `• Buscar con tus preferencias: escribe "recomendado"\n`;
  message += `• Nueva búsqueda: escribe lo que buscas\n`;
  message += `• Menú: "ayuda"`;

  return {
    text: message,
    context: session.context
  };
}

// Manejar comando "guardar [número]"
async function handleSaveProperty(message, session) {
  if (!session.user?.whatsapp_number) {
    return {
      text: '❌ Error guardando propiedad. Intenta de nuevo.',
      context: session.context
    };
  }

  // Extraer número de la propiedad
  const numberMatch = message.match(/(\d+)/);
  if (!numberMatch) {
    return {
      text: '❌ Por favor especifica el número de la propiedad.\n\n💡 Ejemplo: "guardar 3"',
      context: session.context
    };
  }

  const propertyNumber = parseInt(numberMatch[1]);

  // Verificar que hay resultados previos
  if (!session.lastResults || session.lastResults.length === 0) {
    return {
      text: '❌ No hay propiedades para guardar.\n\n💡 Primero busca propiedades y luego puedes guardar las que te gusten.',
      context: session.context
    };
  }

  // Verificar que el número es válido
  if (propertyNumber < 1 || propertyNumber > session.lastResults.length) {
    return {
      text: `❌ Número inválido. Elige un número entre 1 y ${session.lastResults.length}.`,
      context: session.context
    };
  }

  const property = session.lastResults[propertyNumber - 1];

  // Guardar como favorito
  const { saveUserFavorite } = await import('./userManager.js');
  const saved = await saveUserFavorite(
    session.user.whatsapp_number,
    property.originalId,
    property.title,
    property.priceFormatted || `$${property.price?.toLocaleString('es-AR')}`
  );

  if (saved) {
    return {
      text: `⭐ ¡Propiedad guardada como favorita!\n\n🏠 ${property.title || 'Propiedad'}\n💰 ${property.priceFormatted || 'Precio a consultar'}\n\n💡 Escribe "favoritos" para ver todas tus propiedades guardadas.`,
      context: session.context
    };
  } else {
    return {
      text: '❌ Error guardando la propiedad. Puede que ya esté en tus favoritos.',
      context: session.context
    };
  }
}

// Manejar búsqueda recomendada basada en preferencias
async function handleRecommendedSearch(session) {
  if (!session.user?.whatsapp_number) {
    return {
      text: '❌ Error accediendo a tus preferencias.',
      context: session.context
    };
  }

  const { getUserPreferencesData } = await import('./userManager.js');
  const preferences = await getUserPreferencesData(session.user.whatsapp_number);

  if (!preferences) {
    return {
      text: `🤖 Aún no tengo suficientes datos sobre tus gustos.

💡 **Para crear recomendaciones personalizadas:**
• Realiza algunas búsquedas de propiedades
• El sistema aprenderá tus preferencias automáticamente
• Luego podrás usar "recomendado" para búsquedas inteligentes

📱 **¿Qué quieres hacer?**
• Buscar propiedades: escribe tu búsqueda
• Menú: "ayuda"`,
      context: session.context
    };
  }

  // Construir búsqueda basada en preferencias
  let searchQuery = 'propiedades recomendadas';
  const filters = {};

  if (preferences.property_type) {
    searchQuery = `${preferences.property_type.toLowerCase()} recomendado`;
    filters.propertyType = preferences.property_type;
  }

  if (preferences.bedrooms) {
    filters.bedrooms = preferences.bedrooms;
  }

  if (preferences.max_price) {
    filters.priceMax = preferences.max_price;
  }

  if (preferences.neighborhoods) {
    try {
      const neighborhoods = JSON.parse(preferences.neighborhoods);
      if (neighborhoods.length > 0) {
        filters.neighborhood = neighborhoods[0]; // Usar el primer barrio preferido
        searchQuery += ` en ${neighborhoods[0]}`;
      }
    } catch (error) {
      // Ignorar error de parsing
    }
  }

  console.log(`🎯 Búsqueda recomendada para usuario: ${session.user.whatsapp_number}`);
  console.log(`📋 Preferencias aplicadas:`, preferences);
  console.log(`🔍 Query generado: "${searchQuery}"`, filters);

  // Usar la función de búsqueda normal pero con filtros de preferencias
  try {
    const results = await searchProperties(searchQuery, filters, { offset: 0, limit: 20 });

    if (results.properties.length === 0) {
      return {
        text: `🤖 No encontré propiedades que coincidan con tus preferencias actuales.

📋 **Tus preferencias:**
${preferences.property_type ? `• Tipo: ${preferences.property_type}` : ''}
${preferences.bedrooms ? `• Dormitorios: ${preferences.bedrooms}` : ''}
${preferences.max_price ? `• Precio máximo: $${preferences.max_price.toLocaleString('es-AR')}` : ''}

💡 **Sugerencias:**
• Busca manualmente para ampliar tus preferencias
• Las preferencias se ajustarán automáticamente

📱 **Opciones:**
• Nueva búsqueda: escribe lo que buscas
• Menú: "ayuda"`,
        context: session.context
      };
    }

    const summary = createSearchSummary({ query: searchQuery, filters }, results);
    const formattedList = formatPropertyList(results.properties, '🎯 *Propiedades recomendadas para ti:*', results.total, results.hasMore);

    // Actualizar la sesión con los resultados
    session.lastResults = results.properties;
    session.lastQuery = searchQuery;
    session.lastFilters = filters;
    session.currentOffset = 0;

    return {
      text: `${summary}\n\n${formattedList}`,
      properties: results.properties,
      context: {
        ...session.context,
        lastQuery: searchQuery,
        lastFilters: filters,
        lastResults: results.properties,
        currentOffset: 0
      }
    };

  } catch (error) {
    console.error('Error en búsqueda recomendada:', error);
    return {
      text: '❌ Error realizando búsqueda recomendada. Por favor, intenta de nuevo.',
      context: session.context
    };
  }
}