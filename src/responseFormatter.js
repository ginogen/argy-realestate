// responseFormatter.js - Formateador de respuestas para WhatsApp
import { sendWhatsAppLocation } from './ultramsgClient.js';
import { shortenUrl } from './urlShortener.js';

// Formatear lista de propiedades
export function formatPropertyList(properties, title = '🏠 *Propiedades encontradas:*', totalAvailable = null, hasMore = false) {
  if (!properties || properties.length === 0) {
    return '❌ No se encontraron propiedades que coincidan con tu búsqueda.';
  }
  
  let message = title;
  
  // Agregar información de resultados disponibles
  if (totalAvailable && totalAvailable > properties.length) {
    message += ` (mostrando ${properties.length} de ${totalAvailable})`;
  }
  
  message += '\n\n';
  
  properties.forEach((property, index) => {
    const number = index + 1;
    const emoji = getPropertyEmoji(property.propertyType);
    
    message += `${number}️⃣ *${emoji} ${formatPropertyTitle(property)}*\n`;
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
    const desc = property.descriptionNormalized || property.description;
    // Limitar descripción a 500 caracteres para WhatsApp
    const shortDesc = desc.length > 500 ? desc.substring(0, 497) + '...' : desc;
    message += `${shortDesc}\n`;
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
    const shortUrl = shortenUrl(property.url);
    message += `\n🔗 *Ver:* ${shortUrl}\n`;
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

// Formatear mensaje de error
export function formatErrorMessage(error, userMessage) {
  const errorMessages = {
    'no_results': `🔍 No encontré propiedades para: "${userMessage}"\n\n💡 Sugerencias:\n• Amplía el rango de precios\n• Prueba con menos filtros\n• Verifica la zona solicitada`,
    'search_error': '❌ Error en la búsqueda. Por favor, intenta de nuevo.',
    'invalid_input': '❌ No entiendo tu consulta. Intenta con algo como:\n• "Depto 2 dormitorios Centro"\n• "Casa con jardín zona norte"\n• "Algo hasta 400 mil"',
    'timeout': '⏱️ La búsqueda tardó demasiado. Intenta de nuevo.',
    'service_error': '❌ Servicio temporalmente no disponible. Intenta en unos minutos.'
  };
  
  return errorMessages[error] || errorMessages['service_error'];
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