// urlShortener.js - Funciones para acortar URLs
import crypto from 'crypto';

// Cache de URLs acortadas
const urlCache = new Map();

// Función para acortar URL de Zonaprop
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
      const shortUrl = `zonaprop.com.ar/p/${postingId}`;
      urlCache.set(fullUrl, shortUrl);
      return shortUrl;
    }
    
    // Fallback: crear hash corto de la URL
    const hash = crypto.createHash('md5').update(fullUrl).digest('hex').substring(0, 8);
    const shortUrl = `zonaprop.com.ar/prop/${hash}`;
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
  
  // Para otras URLs, mostrar solo el dominio
  try {
    const urlObj = new URL(url);
    return `${urlObj.hostname}...`;
  } catch (error) {
    // Si no es una URL válida, truncar
    return url.length > 50 ? url.substring(0, 47) + '...' : url;
  }
}

// Función para mostrar URL amigable en mensajes
export function formatUrlForMessage(url) {
  if (!url) return '';
  
  const shortened = shortenUrl(url);
  
  // Si es una URL de Zonaprop acortada, agregar enlace completo
  if (shortened.startsWith('zonaprop.com.ar/')) {
    return `${shortened}\n${url}`;
  }
  
  return url;
}