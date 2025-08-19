// imageHandler.js - Manejo de imágenes para WhatsApp
import { sendWhatsAppImage } from './ultramsgClient.js';

// Enviar primera imagen de una propiedad
export async function sendPropertyImage(userPhone, property) {
  try {
    console.log(`📸 Intentando enviar imagen para propiedad:`, {
      id: property.id || property.originalId,
      title: property.title,
      photos: property.photos?.length || 0,
      firstPhoto: property.photos?.[0]
    });
    
    if (!property.photos || property.photos.length === 0) {
      console.log('❌ Propiedad sin fotos disponibles');
      return { success: false, message: 'Propiedad sin fotos' };
    }
    
    // Tomar primera imagen
    const imageUrl = property.photos[0];
    
    // Caption con info mejorada
    const title = property.title && property.title !== 'Sin título' ? property.title : 
                  `${property.propertyType || 'Propiedad'} ${property.bedrooms ? property.bedrooms + ' dorm.' : ''}`;
    
    const location = property.address && property.address !== 'Sin especificar' ? property.address :
                    property.neighborhood && property.neighborhood !== 'Sin especificar' ? property.neighborhood :
                    'Rosario, Santa Fe';
    
    const price = property.priceFormatted || 
                 (property.price > 0 ? `$${property.price.toLocaleString('es-AR')}` : 'Consultar precio');
    
    const caption = `🏠 *${title}*\n` +
                   `📍 ${location}\n` +
                   `💰 ${price}\n` +
                   `🏠 ${property.totalArea ? property.totalArea + 'm²' : ''} | ` +
                   `🛏️ ${property.bedrooms || 0} | 🚿 ${property.bathrooms || 0}\n` +
                   `🔗 ${property.url || 'Ver propiedad'}`;
    
    console.log(`📤 Enviando imagen: ${imageUrl.substring(0, 100)}...`);
    console.log(`📝 Caption: ${caption.substring(0, 100)}...`);
    
    const result = await sendWhatsAppImage(userPhone, imageUrl, caption);
    
    if (result.success) {
      console.log(`✅ Imagen enviada exitosamente`);
    } else {
      console.log(`❌ Error enviando imagen:`, result);
    }
    
    return { success: true, result };
    
  } catch (error) {
    console.error('❌ Error enviando imagen:', error);
    return { success: false, error: error.message };
  }
}

// Enviar galería de imágenes (máximo 3)
export async function sendPropertyGallery(userPhone, property, maxImages = 3) {
  try {
    if (!property.photos || property.photos.length === 0) {
      return { success: false, message: 'Propiedad sin fotos' };
    }
    
    const imagesToSend = property.photos.slice(0, maxImages);
    const results = [];
    
    for (let i = 0; i < imagesToSend.length; i++) {
      const imageUrl = imagesToSend[i];
      
      // Caption solo para primera imagen
      let caption = '';
      if (i === 0) {
        caption = `🏠 ${property.title}\n` +
                 `📍 ${property.address}\n` +
                 `💰 ${property.priceFormatted}\n` +
                 `📸 ${i + 1}/${property.photos.length} fotos`;
      } else {
        caption = `📸 ${i + 1}/${property.photos.length}`;
      }
      
      // Esperar entre imágenes
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      const result = await sendWhatsAppImage(userPhone, imageUrl, caption);
      results.push(result);
    }
    
    return { success: true, results, sentCount: imagesToSend.length };
    
  } catch (error) {
    console.error('Error enviando galería:', error);
    return { success: false, error: error.message };
  }
}

// Verificar si una URL de imagen es válida
export async function validateImageUrl(url) {
  try {
    const response = await fetch(url, { 
      method: 'HEAD',
      timeout: 5000 
    });
    
    const contentType = response.headers.get('content-type');
    const isImage = contentType && contentType.startsWith('image/');
    
    return {
      valid: response.ok && isImage,
      contentType,
      size: response.headers.get('content-length')
    };
    
  } catch (error) {
    return { valid: false, error: error.message };
  }
}