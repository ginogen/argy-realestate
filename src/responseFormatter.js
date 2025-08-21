// responseFormatter.js - Formateador de respuestas para WhatsApp
import { sendWhatsAppLocation } from './ultramsgClient.js';
import { shortenUrl } from './urlShortener.js';

// Función para limpiar HTML y formatear texto
export function sanitizeHtml(text) {
  if (!text) return '';
  
  let cleanText = text
    // Remover todas las etiquetas HTML
    .replace(/<[^>]*>/g, '')
    // Convertir entidades HTML comunes
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    // Agregar saltos de línea después de puntos seguidos de mayúscula
    .replace(/\.\s*([A-Z])/g, '.\n$1')
    // Agregar saltos de línea después de guiones para listas
    .replace(/\s*-\s*/g, '\n• ')
    // Limpiar espacios múltiples
    .replace(/\s+/g, ' ')
    // Limpiar saltos de línea múltiples
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .replace(/\n\s*\n/g, '\n')
    .trim();
  
  return cleanText;
}

// Función para truncar texto de forma inteligente (por palabras)
function smartTruncate(text, maxLength = 1200) {
  if (!text || text.length <= maxLength) return text;
  
  // Buscar el último espacio antes del límite
  let truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.8) { // Si el último espacio no está muy lejos
    truncated = truncated.substring(0, lastSpace);
  }
  
  return truncated + '...';
}

// Formatear lista de propiedades
export function formatPropertyList(properties, title = '🏠 *Propiedades encontradas:*', totalAvailable = null, hasMore = false, viewedIndices = []) {
  if (!properties || properties.length === 0) {
    return '❌ No se encontraron propiedades que coincidan con tu búsqueda.';
  }
  
  let message = title;
  
  // Agregar información de resultados disponibles
  if (totalAvailable && totalAvailable > properties.length) {
    message += ` (mostrando ${properties.length} de ${totalAvailable})`;
  }
  
  // Mostrar información de propiedades vistas si hay alguna
  if (viewedIndices && viewedIndices.length > 0) {
    message += ` (✅ vistas: ${viewedIndices.length})`;
  }
  
  message += '\n\n';
  
  properties.forEach((property, index) => {
    const number = index + 1;
    const emoji = getPropertyEmoji(property.propertyType);
    const isViewed = viewedIndices && viewedIndices.includes(index);
    
    // Agregar checkmark si la propiedad fue vista
    const viewedMark = isViewed ? '✅ ' : '';
    
    message += `${viewedMark}${number}️⃣ *${emoji} ${formatPropertyTitle(property)}*\n`;
    message += `📍 ${formatLocation(property)}\n`;
    message += `💰 ${formatPrice(property)}\n`;
    message += `🏠 ${formatFeatures(property)}\n`;
    
    // Agregar características destacadas
    const highlights = getPropertyHighlights(property);
    if (highlights.length > 0) {
      message += `✨ ${highlights.join(' • ')}\n`;
    }
    
    message += `\n`;
  });
  
  // Agregar navegación y opciones
  message += '\n📱 **OPCIONES DISPONIBLES:**\n';
  message += `• Detalles: escribe un número (1-${Math.min(properties.length, 20)})\n`;
  message += '• Fotos: "foto [número]" (ej: foto 3)\n';
  message += '• Guardar: "guardar [número]" (ej: guardar 5)\n';
  
  if (hasMore) {
    message += '• Más resultados: escribe "más"\n';
  }
  
  message += '• Nueva búsqueda: escribe lo que buscas\n';
  message += '• Menú: escribe "ayuda"\n';
  
  return message.trim();
}

// Formatear detalles completos de una propiedad
export function formatPropertyDetails(property) {
  const emoji = getPropertyEmoji(property.propertyType);
  
  // Título mejorado
  const title = property.title && property.title !== 'Sin título' ? 
    property.title : 
    `${property.propertyType || 'Propiedad'} ${property.bedrooms ? property.bedrooms + ' dorm.' : ''}`;
  
  let message = `${emoji} *${title}*\n\n`;
  
  // Ubicación
  message += `📍 *Ubicación:*\n`;
  if (property.address && property.address !== 'Sin dirección') {
    message += `   ${property.address}\n`;
  }
  message += `   ${property.neighborhood}, ${property.city}\n\n`;
  
  // Precio
  message += `💰 *Precio:*\n`;
  message += `   ${formatPrice(property, true)}\n\n`;
  
  // Características principales
  message += `🏠 *Características:*\n`;
  message += formatDetailedFeatures(property);
  
  // Descripción normalizada o normal
  if (property.descriptionNormalized || property.description) {
    message += `\n📝 *Descripción:*\n`;
    const rawDesc = property.descriptionNormalized || property.description;
    
    // Limpiar HTML y formatear
    const cleanDesc = sanitizeHtml(rawDesc);
    
    // Truncar de forma inteligente (máximo 1200 caracteres)
    const formattedDesc = smartTruncate(cleanDesc, 1200);
    
    message += `${formattedDesc}\n`;
    
    // Si se truncó, mostrar opción para ver completa
    if (formattedDesc.endsWith('...')) {
      message += `\n💬 _Escribe "descripción completa" para ver toda la descripción_\n`;
    }
  }
  
  // Características especiales
  const amenities = getPropertyAmenities(property);
  if (amenities.length > 0) {
    message += `\n✨ *Amenidades:*\n`;
    amenities.forEach(amenity => {
      message += `   • ${amenity}\n`;
    });
  }
  
  // Información del publicador
  if (property.publisher) {
    message += `\n🏢 *Inmobiliaria:*\n`;
    message += `   ${property.publisher}\n`;
    if (property.publisherPhone) {
      // Formatear teléfono como enlace de WhatsApp
      const phoneNumber = property.publisherPhone.replace(/\D/g, ''); // Remover no-dígitos
      const whatsappNumber = phoneNumber.startsWith('54') ? phoneNumber : `549${phoneNumber}`;
      message += `   📱 https://wa.me/${whatsappNumber}\n`;
    }
  }
  
  // URL de la propiedad
  if (property.url) {
    // Mostrar solo el enlace real clickeable con texto descriptivo
    message += `\n🔗 *Ver propiedad:* ${property.url}\n`;
  }
  
  // Fotos
  if (property.photosCount > 0) {
    message += `\n📸 ${property.photosCount} foto${property.photosCount > 1 ? 's' : ''} disponible${property.photosCount > 1 ? 's' : ''}\n`;
  }
  
  // Score de relevancia (solo en desarrollo)
  if (process.env.NODE_ENV === 'development' && property.score) {
    message += `\n🎯 Score: ${property.score.toFixed(2)} | Relevancia: ${property.relevanceScore?.toFixed(1) || 'N/A'}\n`;
  }
  
  // Agregar opciones de navegación
  message += `\n📱 **¿QUÉ QUIERES HACER?**\n`;
  message += `• Ver fotos: escribe "foto"\n`;
  message += `• Guardar: "guardar ${property.originalId || '1'}"\n`;
  message += `• Volver a resultados: "más" o nueva búsqueda\n`;
  message += `• Menú principal: "ayuda"\n`;
  
  return message;
}

// Obtener emoji según tipo de propiedad
function getPropertyEmoji(propertyType) {
  const emojiMap = {
    'Departamento': '🏢',
    'Casa': '🏠',
    'PH': '🏘️',
    'Terreno': '🏞️',
    'Oficina': '🏢',
    'Local': '🏪',
    'Depósito': '🏭',
    'Cochera': '🚗'
  };
  
  return emojiMap[propertyType] || '🏠';
}

// Formatear título de propiedad
function formatPropertyTitle(property) {
  // Usar el título original si existe y no es genérico
  if (property.title && 
      property.title !== 'Sin título' && 
      property.title !== 'Sin especificar' &&
      property.title.length > 10) {
    return property.title.substring(0, 50);
  }
  
  // Construir título descriptivo
  let title = property.propertyType || 'Propiedad';
  
  if (property.bedrooms > 0) {
    title += ` ${property.bedrooms} dorm.`;
  }
  
  if (property.bathrooms > 0) {
    title += ` ${property.bathrooms} baños`;
  }
  
  if (property.totalArea > 0) {
    title += ` ${property.totalArea}m²`;
  }
  
  // Agregar barrio si está disponible
  if (property.neighborhood && property.neighborhood !== 'Sin especificar') {
    title += ` - ${property.neighborhood}`;
  }
  
  return title;
}

// Formatear ubicación
function formatLocation(property) {
  const parts = [];
  
  // Agregar dirección si existe y no es genérica
  if (property.address && 
      property.address !== 'Sin especificar' && 
      property.address.length > 5) {
    // Mostrar dirección completa pero limitada
    const address = property.address.substring(0, 40);
    parts.push(address);
  }
  
  // Agregar barrio si es diferente de la dirección
  if (property.neighborhood && 
      property.neighborhood !== 'Sin especificar' &&
      !property.address?.includes(property.neighborhood)) {
    parts.push(property.neighborhood);
  }
  
  // Si no tenemos dirección específica, mostrar al menos barrio y ciudad
  if (parts.length === 0) {
    if (property.neighborhood && property.neighborhood !== 'Sin especificar') {
      parts.push(property.neighborhood);
    }
    if (property.city && property.city !== 'Sin especificar') {
      parts.push(property.city);
    }
  }
  
  return parts.join(', ') || 'Rosario, Santa Fe';
}

// Formatear precio
function formatPrice(property, detailed = false) {
  let priceText = '';
  
  if (property.price > 0) {
    priceText = `$${property.priceFormatted || property.price.toLocaleString('es-AR')}`;
  } else {
    priceText = 'Consultar precio';
  }
  
  if (detailed) {
    if (property.expenses > 0) {
      priceText += ` + $${property.expenses.toLocaleString('es-AR')} expensas`;
    } else {
      priceText += ' (sin expensas)';
    }
  } else if (property.expenses > 0) {
    priceText += ` + exp.`;
  }
  
  return priceText;
}

// Formatear características básicas
function formatFeatures(property) {
  const features = [];
  
  if (property.totalArea > 0) {
    features.push(`${property.totalArea}m²`);
  }
  
  if (property.bedrooms > 0) {
    features.push(`🛏️ ${property.bedrooms}`);
  }
  
  if (property.bathrooms > 0) {
    features.push(`🚿 ${property.bathrooms}`);
  }
  
  if (property.garages > 0) {
    features.push(`🚗 ${property.garages}`);
  }
  
  return features.join(' | ') || 'Sin información';
}

// Formatear características detalladas
function formatDetailedFeatures(property) {
  let features = '';
  
  if (property.totalArea > 0) {
    features += `   📐 Superficie total: ${property.totalArea}m²\n`;
  }
  
  if (property.coveredArea > 0) {
    features += `   🏠 Superficie cubierta: ${property.coveredArea}m²\n`;
  }
  
  if (property.bedrooms > 0) {
    features += `   🛏️ Dormitorios: ${property.bedrooms}\n`;
  }
  
  if (property.bathrooms > 0) {
    features += `   🚿 Baños: ${property.bathrooms}\n`;
  }
  
  if (property.rooms > 0 && property.rooms !== property.bedrooms) {
    features += `   🏠 Ambientes: ${property.rooms}\n`;
  }
  
  if (property.garages > 0) {
    features += `   🚗 Cocheras: ${property.garages}\n`;
  }
  
  if (property.antiquity) {
    features += `   📅 Antigüedad: ${property.antiquity}\n`;
  }
  
  return features || '   Sin información detallada\n';
}

// Obtener highlights de la propiedad
function getPropertyHighlights(property) {
  const highlights = [];
  
  if (property.hasBalcony) highlights.push('Balcón');
  if (property.hasTerrace) highlights.push('Terraza');
  if (property.hasGarden) highlights.push('Jardín');
  if (property.hasPool) highlights.push('Pileta');
  if (property.hasSecurity) highlights.push('Seguridad');
  if (property.hasGym) highlights.push('Gimnasio');
  
  // Destacar si tiene muchas fotos
  if (property.photosCount > 10) {
    highlights.push(`${property.photosCount} fotos`);
  }
  
  // Destacar si es muy espacioso
  if (property.totalArea > 100) {
    highlights.push('Amplio');
  }
  
  return highlights;
}

// Obtener amenidades completas
function getPropertyAmenities(property) {
  const amenities = [];
  
  if (property.hasBalcony) amenities.push('Balcón');
  if (property.hasTerrace) amenities.push('Terraza');
  if (property.hasGarden) amenities.push('Jardín');
  if (property.hasPool) amenities.push('Pileta');
  if (property.hasSecurity) amenities.push('Seguridad 24hs');
  if (property.hasGym) amenities.push('Gimnasio');
  
  return amenities;
}

// Sistema de mensajes de error contextual y humano
export function formatErrorMessage(errorType, context = {}) {
  const { userMessage, attemptCount = 1, lastAction, hasAlternatives = true } = context;
  
  const errorMessages = {
    // Búsquedas sin resultados - tono optimista y sugerente
    'no_results': [
      `🤔 Hmm, no encontré propiedades para "${userMessage}".\n\n💡 ¿Qué te parece si probamos con:\n• Un rango de precios más amplio\n• Menos filtros específicos\n• Una zona cercana`,
      `🔍 Esta vez no hubo suerte con "${userMessage}".\n\n¿Te ayudo a ajustar la búsqueda? Puedo:\n• Mostrarte zonas similares\n• Sugerir precios en esa área\n• Ver tus búsquedas anteriores`,
      `No te preocupes, a veces hay que afinar la búsqueda 😊\n\n¿Probamos con criterios un poco diferentes? O si quieres, puedo mostrarte tus favoritos mientras tanto.`
    ],
    
    // Errores técnicos de búsqueda - tono empático
    'search_error': [
      `🤔 Algo no funcionó bien con la búsqueda. ¿Podrías intentar de nuevo?\n\nMientras tanto, ¿te gustaría ver tus propiedades guardadas?`,
      `Ups, parece que hubo un pequeño problema técnico. ¿Intentamos otra vez?\n\nO puedo ayudarte de otra forma: ¿quieres ver tu historial de búsquedas?`,
      `Disculpa, el sistema tuvo un hiccup 😅 ¿Lo intentamos de nuevo?\n\nSi el problema persiste, escribe "ayuda" para ver otras opciones.`
    ],
    
    // Input inválido - tono educativo y amigable  
    'invalid_input': [
      `🤷‍♂️ No estoy seguro de entender lo que buscas.\n\n¿Podrías intentar con algo como:\n• "Depto 2 dormitorios Centro"\n• "Casa con jardín zona norte"\n• "Algo hasta 400 mil"`,
      `No logro entender tu búsqueda. ¿Me ayudas reformulándola?\n\n💡 Algunos ejemplos que funcionan bien:\n• "3 dormitorios Pichincha"\n• "Casa barata zona sur"\n• "Departamento hasta 300 mil"`,
      `¿Podrías ser un poco más específico? Me ayuda si mencionas:\n• Tipo de propiedad (casa, depto)\n• Cantidad de dormitorios\n• Zona o precio aproximado`
    ],
    
    // Timeouts - tono tranquilizador
    'timeout': [
      `⏱️ La búsqueda está tomando más tiempo del usual. ¿Intentamos de nuevo?\n\nA veces pasa cuando hay mucha demanda.`,
      `Parece que la conexión está un poco lenta hoy. ¿Probamos otra vez?\n\n¿O prefieres que te muestre algo de tu historial mientras esperamos?`,
      `La búsqueda se está tomando su tiempo... ¿Reintentamos?\n\nTambién puedo mostrarte propiedades similares a las que viste antes.`
    ],
    
    // Errores de servicio - tono profesional pero humano
    'service_error': [
      `😔 Disculpa, algo no está funcionando bien de mi lado.\n\n¿Podrías intentar en unos minutos? Mientras tanto, ¿hay algo más en lo que pueda ayudarte?`,
      `Parece que tenemos un problemita técnico. ¿Intentamos en un ratito?\n\n¿Te gustaría ver tus propiedades favoritas mientras se resuelve?`,
      `Ups, el sistema está teniendo dificultades. Inténtalo en unos minutos, por favor.\n\nSi es urgente, escribe "ayuda" para ver otras opciones.`
    ],
    
    // Errores de acceso a datos - tono disculpándose
    'data_access_error': [
      `😅 Perdón, no pude acceder a tus datos en este momento.\n\n¿Podrías intentar de nuevo? Si el problema persiste, hazme saber.`,
      `Tuve un problemita accediendo a tu información. ¿Reintentamos?\n\nMientras tanto, puedo ayudarte con búsquedas nuevas.`,
      `Disculpa, no pude conectar con tus datos guardados. ¿Lo intentamos otra vez?\n\n¿O prefieres hacer una búsqueda nueva?`
    ],
    
    // Números/comandos inválidos - tono guía amigable
    'invalid_number': [
      `🤔 Ese número no está en la lista. ¿Podrías elegir uno entre 1 y {max}?\n\n💡 Tip: Primero busca propiedades, luego elige el número que te interese.`,
      `No encuentro esa propiedad. Asegúrate de elegir un número de la lista anterior.\n\n¿O prefieres hacer una nueva búsqueda?`,
      `Hmm, ese número no coincide con ninguna propiedad. ¿Revisas la lista?\n\nTambién puedes escribir lo que buscas para empezar de nuevo.`
    ],
    
    // Sin fotos - tono lamentándose pero ofreciendo alternativas
    'no_photos': [
      `😕 Esta propiedad no tiene fotos disponibles por el momento.\n\n¿Te muestro los detalles completos o prefieres ver otra propiedad?`,
      `Lamentablemente no hay fotos de esta propiedad.\n\n¿Quieres que te describa más detalles o buscamos opciones similares?`,
      `No tengo fotos de esta para mostrarte, perdón.\n\n¿Te ayudo con información detallada o buscamos otras opciones?`
    ],

    // Sin búsqueda previa - tono orientativo
    'no_previous_search': [
      `🤷‍♂️ No tengo una búsqueda anterior para mostrar más resultados.\n\n¿Qué te gustaría buscar? Puedo ayudarte a encontrar propiedades.`,
      `Aún no has hecho ninguna búsqueda. ¿Por dónde empezamos?\n\n💡 Escribe algo como "departamento centro" para comenzar.`,
      `No hay búsquedas previas. ¿Qué tipo de propiedad te interesa?\n\nPuedo ayudarte a encontrar casas, departamentos, lo que necesites.`
    ]
  };
  
  const messages = errorMessages[errorType] || errorMessages['service_error'];
  const messageIndex = Math.min(attemptCount - 1, messages.length - 1);
  let message = messages[messageIndex];
  
  // Reemplazar placeholders dinámicos
  if (context.max) {
    message = message.replace('{max}', context.max);
  }
  
  return message;
}

// Función auxiliar para generar mensajes de error con contexto
export function createErrorContext(userMessage, session, errorType, additionalContext = {}) {
  const context = {
    userMessage,
    attemptCount: (session.errorCounts?.[errorType] || 0) + 1,
    lastAction: session.lastAction,
    hasAlternatives: session.lastResults?.length > 0 || session.context?.favorites?.length > 0,
    ...additionalContext
  };
  
  // Incrementar contador de errores para degradación gradual
  if (!session.errorCounts) session.errorCounts = {};
  session.errorCounts[errorType] = context.attemptCount;
  
  return context;
}

// Formatear resumen de búsqueda
export function formatSearchSummary(filters, count) {
  const parts = [];
  
  if (filters.propertyType) {
    parts.push(filters.propertyType.toLowerCase());
  }
  
  if (filters.bedrooms) {
    parts.push(`${filters.bedrooms} dormitorios`);
  }
  
  if (filters.priceMax) {
    parts.push(`hasta $${filters.priceMax.toLocaleString('es-AR')}`);
  }
  
  if (filters.neighborhood) {
    parts.push(`en ${filters.neighborhood}`);
  }
  
  let summary = `🔍 ${count} ${count === 1 ? 'propiedad encontrada' : 'propiedades encontradas'}`;
  
  if (parts.length > 0) {
    summary += ` (${parts.join(', ')})`;
  }
  
  return summary;
}

// Formatear opciones de acción
export function formatActionOptions() {
  return '\n📱 *Opciones:*\n' +
         '• Escribe el número (1-20) para ver detalles\n' +
         '• Escribe "foto [número]" para ver imagen\n' +
         '• Escribe "más" para ver más resultados\n' +
         '• Haz una nueva búsqueda para refinar';
}

// Formatear mensaje de bienvenida
export function formatWelcomeMessage() {
  return `¡Hola! 👋 Soy tu asistente de propiedades en Rosario.

🏠 *¿Qué puedo hacer?*
• Buscar departamentos y casas en alquiler
• Filtrar por precio, zona, dormitorios
• Mostrar detalles completos con fotos

💬 *Ejemplos de búsquedas:*
• "Departamento 2 dormitorios en Centro hasta 400 mil"
• "Casa con jardín en zona norte"
• "Algo económico cerca del centro"

¿Qué tipo de propiedad estás buscando?`;
}