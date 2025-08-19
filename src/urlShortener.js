// urlShortener.js - Funciones para acortar URLs
import crypto from 'crypto';

// Cache de URLs acortadas
const urlCache = new Map();

// Función para enmascarar y acortar URL de Zonaprop
export function shortenZonapropUrl(fullUrl) {
  if (!fullUrl || !fullUrl.includes('zonaprop.com.ar')) {
    return fullUrl;
  }
  
  // Verificar si ya está en cache
  if (urlCache.has(fullUrl)) {
    return urlCache.get(fullUrl);
  }
  
  try {
    // Extraer el ID del posting de la URL
    const match = fullUrl.match(/([0-9]{8,})/);
    if (match) {
      const postingId = match[1];
      // URL enmascarada - parece un acortador genérico
      const shortUrl = `prop.ar/${postingId}`;
      urlCache.set(fullUrl, shortUrl);
      return shortUrl;
    }
    
    // Fallback: crear hash corto de la URL
    const hash = crypto.createHash('md5').update(fullUrl).digest('hex').substring(0, 8);
    const shortUrl = `prop.ar/${hash}`;
    urlCache.set(fullUrl, shortUrl);
    return shortUrl;
    
  } catch (error) {
    console.error('Error acortando URL:', error);
    return fullUrl;
  }
}

// Función general para acortar cualquier URL larga
export function shortenUrl(url) {
  if (!url || url.length <= 50) {
    return url;
  }
  
  // URLs específicas de Zonaprop
  if (url.includes('zonaprop.com.ar')) {
    return shortenZonapropUrl(url);
  }
  
  // Para otras URLs de propiedades, crear enlaces genéricos
  if (url.includes('mercadolibre') || url.includes('argenprop') || url.includes('properati')) {
    try {
      const hash = crypto.createHash('md5').update(url).digest('hex').substring(0, 8);
      return `prop.ar/${hash}`;
    } catch (error) {
      return `prop.ar/link`;
    }
  }
  
  // Para otras URLs, mostrar solo el dominio
  try {
    const urlObj = new URL(url);
    return `link.ar/${urlObj.hostname}`;
  } catch (error) {
    // Si no es una URL válida, truncar
    return url.length > 50 ? url.substring(0, 47) + '...' : url;
  }
}

// Función para mostrar URL amigable en mensajes
export function formatUrlForMessage(url) {
  if (!url) return '';
  
  const shortened = shortenUrl(url);
  
  // Para URLs enmascaradas, solo mostrar la versión corta
  if (shortened.startsWith('prop.ar/') || shortened.startsWith('link.ar/')) {
    return shortened;
  }
  
  return shortened;
}