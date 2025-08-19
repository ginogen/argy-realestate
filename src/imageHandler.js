// imageHandler.js - Manejo de imágenes para WhatsApp
import { sendWhatsAppImage } from './ultramsgClient.js';
import { shortenUrl } from './urlShortener.js';

// Enviar imágenes de una propiedad (hasta 5 imágenes)
export async function sendPropertyImage(userPhone, property) {
  try {
    console.log(`📸 Intentando enviar imágenes para propiedad:`, {
      id: property.id || property.originalId,
      title: property.title,
      photos: property.photos?.length || 0,
      firstPhoto: property.photos?.[0]
    });
    
    if (!property.photos || property.photos.length === 0) {
      console.log('❌ Propiedad sin fotos disponibles');
      return { success: false, message: 'Propiedad sin fotos' };
    }
    
    // Enviar todas las fotos disponibles
    const maxImages = property.photos.length;
    console.log(`📸 Enviando todas las ${maxImages} imagen(es) disponibles`);
    
    // Si solo hay 1 imagen, usar lógica simple
    if (property.photos.length === 1) {
      return await sendSinglePropertyImage(userPhone, property);
    }
    
    // Para múltiples imágenes, usar galería
    return await sendPropertyGallery(userPhone, property, maxImages);
    
  } catch (error) {
    console.error('❌ Error enviando imágenes:', error);
    return { success: false, error: error.message };
  }
}

// Función auxiliar para enviar una sola imagen 
async function sendSinglePropertyImage(userPhone, property) {
  const imageUrl = property.photos[0];
  const caption = `📸 1/1`;
  
  console.log(`📤 Enviando imagen única: ${imageUrl.substring(0, 100)}...`);
  
  const result = await sendWhatsAppImage(userPhone, imageUrl, caption);
  
  if (result.success) {
    console.log(`✅ Imagen enviada exitosamente`);
  } else {
    console.log(`❌ Error enviando imagen:`, result);
  }
  
  return { success: true, result };
}

// Enviar galería de imágenes (todas las disponibles)
export async function sendPropertyGallery(userPhone, property, maxImages = null) {
  try {
    if (!property.photos || property.photos.length === 0) {
      return { success: false, message: 'Propiedad sin fotos' };
    }
    
    // Enviar todas las fotos disponibles
    const imagesToSend = maxImages ? property.photos.slice(0, maxImages) : property.photos;
    const results = [];
    
    for (let i = 0; i < imagesToSend.length; i++) {
      const imageUrl = imagesToSend[i];
      
      // Caption simple: solo numeración
      let caption = `📸 ${i + 1}/${property.photos.length}`;
      
      console.log(`📤 Enviando imagen ${i + 1}/${imagesToSend.length}: ${imageUrl.substring(0, 80)}...`);
      
      // Esperar entre imágenes para no saturar la API
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      
      const result = await sendWhatsAppImage(userPhone, imageUrl, caption);
      results.push(result);
      
      if (!result.success) {
        console.log(`⚠️ Error en imagen ${i + 1}, continuando con las siguientes...`);
      }
    }
    
    const successfulSends = results.filter(r => r.success).length;
    console.log(`✅ Galería enviada: ${successfulSends}/${imagesToSend.length} imágenes exitosas`);
    
    return { 
      success: successfulSends > 0, 
      results, 
      sentCount: successfulSends,
      totalImages: imagesToSend.length 
    };
    
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