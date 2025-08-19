// responseFormatter.js - Formateador de respuestas para WhatsApp
import { sendWhatsAppLocation } from './ultramsgClient.js';

// Formatear lista de propiedades
export function formatPropertyList(properties, title = '🏠 *Propiedades encontradas:*') {
  if (!properties || properties.length === 0) {
    return '❌ No se encontraron propiedades que coincidan con tu búsqueda.';
  }
  
  let message = title + '\n\n';
  
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
  
  return message.trim();
}

// Formatear detalles completos de una propiedad
export function formatPropertyDetails(property) {
  const emoji = getPropertyEmoji(property.propertyType);
  
  let message = `${emoji} *${property.title}*\n\n`;
  
  // Ubicación
  message += `📍 *Ubicación:*\n`;
  message += `   ${property.address}\n`;
  message += `   ${property.neighborhood}, ${property.city}\n\n`;
  
  // Precio
  message += `💰 *Precio:*\n`;
  message += `   ${formatPrice(property, true)}\n\n`;
  
  // Características principales
  message += `🏠 *Características:*\n`;
  message += formatDetailedFeatures(property);
  
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
      message += `   📞 ${property.publisherPhone}\n`;
    }
  }
  
  // URL de la propiedad
  message += `\n🔗 *Ver más detalles:*\n${property.url}\n`;
  
  // Fotos
  if (property.photosCount > 0) {
    message += `\n📸 ${property.photosCount} foto${property.photosCount > 1 ? 's' : ''} disponible${property.photosCount > 1 ? 's' : ''}\n`;
  }
  
  // Score de relevancia (solo en desarrollo)
  if (process.env.NODE_ENV === 'development' && property.score) {
    message += `\n🎯 Score: ${property.score.toFixed(2)} | Relevancia: ${property.relevanceScore?.toFixed(1) || 'N/A'}\n`;
  }
  
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
  let title = property.propertyType || 'Propiedad';
  
  if (property.bedrooms > 0) {
    title += ` ${property.bedrooms} dorm.`;
  }
  
  if (property.neighborhood) {
    title += ` - ${property.neighborhood}`;
  }
  
  return title;
}

// Formatear ubicación
function formatLocation(property) {
  const parts = [];
  
  if (property.neighborhood) {
    parts.push(property.neighborhood);
  }
  
  if (property.address && property.address !== property.neighborhood) {
    // Mostrar solo primeras palabras de la dirección para ahorrar espacio
    const shortAddress = property.address.split(' ').slice(0, 3).join(' ');
    parts.push(shortAddress);
  }
  
  return parts.join(' - ') || 'Ubicación no especificada';
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
         '• Escribe el número (1-10) para ver detalles\n' +
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