// userManager.js - Gestor de usuarios que combina SQLite persistente con sesiones en memoria
import { 
  initializeDatabase, 
  getOrCreateUser, 
  updateUser,
  getUserPreferences,
  saveUserPreferences,
  saveSearchHistory,
  getSearchHistory,
  incrementUserSearches,
  savePropertyAsFavorite,
  getUserFavorites,
  removeFavorite
} from './database.js';

// Sesiones en memoria para datos temporales (más rápido)
const sessions = new Map();
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutos

// Inicializar la base de datos
initializeDatabase();

// Estructura de sesión temporal
function createSession(user) {
  return {
    user,
    createdAt: new Date(),
    lastActivity: new Date(),
    
    // Datos temporales de la sesión actual
    lastMessage: null,
    lastResponse: null,
    lastQuery: null,
    lastFilters: null,
    lastResults: null,
    currentOffset: 0,
    
    // Contexto temporal para IA
    context: {},
    conversationHistory: []
  };
}

// === FUNCIONES PRINCIPALES ===

// Obtener o crear usuario (combina DB + sesión)
export async function getOrCreateUserSession(whatsappNumber, firstName = null) {
  const cleanNumber = whatsappNumber.replace(/[^0-9]/g, '');
  
  try {
    // 1. Obtener/crear usuario en BD persistente
    const user = getOrCreateUser(cleanNumber, firstName);
    if (!user) {
      throw new Error('Error creando usuario en BD');
    }
    
    // 2. Verificar sesión en memoria
    let session = sessions.get(cleanNumber);
    
    if (!session) {
      console.log(`👤 Nueva sesión creada para usuario: ${cleanNumber} (DB ID: ${user.id})`);
      session = createSession(user);
      sessions.set(cleanNumber, session);
    } else {
      // Verificar expiración
      const now = new Date();
      if (now - session.lastActivity > SESSION_TIMEOUT) {
        console.log(`⏱️ Sesión expirada para usuario: ${cleanNumber}, creando nueva`);
        session = createSession(user);
        sessions.set(cleanNumber, session);
      } else {
        session.lastActivity = now;
        // Actualizar datos del usuario por si cambiaron
        session.user = user;
      }
    }
    
    return session;
    
  } catch (error) {
    console.error('❌ Error en getOrCreateUserSession:', error);
    return null;
  }
}

// Actualizar sesión temporal
export function updateSession(whatsappNumber, updates) {
  const cleanNumber = whatsappNumber.replace(/[^0-9]/g, '');
  const session = sessions.get(cleanNumber);
  
  if (!session) {
    console.error(`❌ Sesión no encontrada para usuario: ${cleanNumber}`);
    return;
  }
  
  // Actualizar campos temporales
  Object.keys(updates).forEach(key => {
    if (key === 'conversationHistory') {
      session.conversationHistory.push(...updates[key]);
      // Mantener solo últimos 20 mensajes
      if (session.conversationHistory.length > 20) {
        session.conversationHistory = session.conversationHistory.slice(-20);
      }
    } else {
      session[key] = updates[key];
    }
  });
  
  session.lastActivity = new Date();
  console.log(`📝 Sesión actualizada para usuario: ${cleanNumber}`);
}

// === FUNCIONES DE PREFERENCIAS ===

// Obtener preferencias del usuario (desde BD)
export function getUserPreferencesData(whatsappNumber) {
  const session = sessions.get(whatsappNumber.replace(/[^0-9]/g, ''));
  if (!session?.user) return null;
  
  return getUserPreferences(session.user.id);
}

// Guardar preferencias del usuario (en BD)
export function saveUserPreferencesData(whatsappNumber, preferences) {
  const session = sessions.get(whatsappNumber.replace(/[^0-9]/g, ''));
  if (!session?.user) return false;
  
  return saveUserPreferences(session.user.id, preferences);
}

// === FUNCIONES DE HISTORIAL DE BÚSQUEDAS ===

// Guardar búsqueda en historial (en BD)
export function saveUserSearchHistory(whatsappNumber, query, filters, resultsCount = 0) {
  const session = sessions.get(whatsappNumber.replace(/[^0-9]/g, ''));
  if (!session?.user) return false;
  
  // Incrementar contador de búsquedas
  incrementUserSearches(session.user.id);
  
  // Guardar en historial
  return saveSearchHistory(session.user.id, query, filters, resultsCount);
}

// Obtener historial de búsquedas (desde BD)
export function getUserSearchHistory(whatsappNumber, limit = 10) {
  const session = sessions.get(whatsappNumber.replace(/[^0-9]/g, ''));
  if (!session?.user) return [];
  
  return getSearchHistory(session.user.id, limit);
}

// === FUNCIONES DE FAVORITOS ===

// Guardar propiedad como favorita
export function saveUserFavorite(whatsappNumber, propertyId, title = null, price = null) {
  const session = sessions.get(whatsappNumber.replace(/[^0-9]/g, ''));
  if (!session?.user) return false;
  
  return savePropertyAsFavorite(session.user.id, propertyId, title, price);
}

// Obtener favoritos del usuario
export function getUserFavoritesData(whatsappNumber) {
  const session = sessions.get(whatsappNumber.replace(/[^0-9]/g, ''));
  if (!session?.user) return [];
  
  return getUserFavorites(session.user.id);
}

// Eliminar favorito
export function removeUserFavorite(whatsappNumber, propertyId) {
  const session = sessions.get(whatsappNumber.replace(/[^0-9]/g, ''));
  if (!session?.user) return false;
  
  return removeFavorite(session.user.id, propertyId);
}

// === FUNCIONES DE COMPATIBILIDAD (manteniendo las originales) ===

// Obtener sesión (compatible con código anterior)
export async function getSession(whatsappNumber) {
  const session = await getOrCreateUserSession(whatsappNumber);
  
  if (!session) {
    // Fallback session si hay error en BD
    const cleanNumber = whatsappNumber.replace(/[^0-9]/g, '');
    return createTempSession(cleanNumber);
  }
  
  // Agregar propiedades esperadas por el código anterior
  session.context = session.context || {};
  session.preferences = getUserPreferences(session.user.id) || {
    maxPrice: null,
    preferredNeighborhoods: [],
    preferredPropertyTypes: [],
    minBedrooms: null
  };
  
  return session;
}

// Crear sesión temporal de emergencia
function createTempSession(userId) {
  return {
    userId,
    user: { id: null, whatsapp_number: userId },
    createdAt: new Date(),
    lastActivity: new Date(),
    context: {},
    lastMessage: null,
    lastResponse: null,
    lastQuery: null,
    lastFilters: null,
    lastResults: null,
    currentOffset: 0,
    conversationHistory: [],
    preferences: {
      maxPrice: null,
      preferredNeighborhoods: [],
      preferredPropertyTypes: [],
      minBedrooms: null
    }
  };
}

// Agregar al historial de conversación (temporal)
export function addToConversationHistory(whatsappNumber, type, content) {
  const cleanNumber = whatsappNumber.replace(/[^0-9]/g, '');
  const session = sessions.get(cleanNumber);
  
  if (!session) return;
  
  const historyEntry = {
    type, // 'user' o 'bot'
    content,
    timestamp: new Date(),
    id: Date.now().toString()
  };
  
  session.conversationHistory.push(historyEntry);
  
  // Mantener solo últimos 20 mensajes
  if (session.conversationHistory.length > 20) {
    session.conversationHistory = session.conversationHistory.slice(-20);
  }
  
  session.lastActivity = new Date();
}

// Obtener contexto para IA
export function getContextForAI(whatsappNumber) {
  const cleanNumber = whatsappNumber.replace(/[^0-9]/g, '');
  const session = sessions.get(cleanNumber);
  
  if (!session) return {};
  
  // Combinar datos de sesión temporal + preferencias persistentes
  const preferences = getUserPreferences(session.user?.id) || {};
  
  return {
    lastQuery: session.lastQuery,
    lastFilters: session.lastFilters,
    preferences: preferences,
    recentSearches: session.conversationHistory
      .filter(entry => entry.type === 'user')
      .slice(-3)
      .map(entry => entry.content)
  };
}

// Aprender de comportamiento (guardar preferencias automáticamente)
export function learnFromUserBehavior(whatsappNumber, searchFilters, selectedProperties = []) {
  const session = sessions.get(whatsappNumber.replace(/[^0-9]/g, ''));
  if (!session?.user) return;
  
  // Obtener preferencias actuales
  let preferences = getUserPreferences(session.user.id) || {};
  let hasChanges = false;
  
  // Aprender precio preferido
  if (searchFilters.priceMax) {
    if (!preferences.max_price || searchFilters.priceMax < preferences.max_price) {
      preferences.max_price = searchFilters.priceMax;
      hasChanges = true;
    }
  }
  
  // Aprender tipo de propiedad
  if (searchFilters.propertyType) {
    if (preferences.property_type !== searchFilters.propertyType) {
      preferences.property_type = searchFilters.propertyType;
      hasChanges = true;
    }
  }
  
  // Aprender dormitorios
  if (searchFilters.bedrooms) {
    if (!preferences.bedrooms || searchFilters.bedrooms !== preferences.bedrooms) {
      preferences.bedrooms = searchFilters.bedrooms;
      hasChanges = true;
    }
  }
  
  // Aprender barrios (array JSON)
  if (searchFilters.neighborhood) {
    const neighborhoods = preferences.neighborhoods ? JSON.parse(preferences.neighborhoods) : [];
    if (!neighborhoods.includes(searchFilters.neighborhood)) {
      neighborhoods.push(searchFilters.neighborhood);
      // Mantener solo 5 barrios
      if (neighborhoods.length > 5) {
        neighborhoods.splice(0, neighborhoods.length - 5);
      }
      preferences.neighborhoods = neighborhoods;
      hasChanges = true;
    }
  }
  
  // Guardar cambios si hubo alguno
  if (hasChanges) {
    saveUserPreferences(session.user.id, preferences);
    console.log(`🧠 Preferencias actualizadas para usuario: ${whatsappNumber.replace(/[^0-9]/g, '')}`);
  }
}

// === LIMPIEZA Y MANTENIMIENTO ===

// Limpiar sesiones expiradas (solo memoria)
export function cleanExpiredSessions() {
  const now = new Date();
  let cleaned = 0;
  
  for (const [userId, session] of sessions.entries()) {
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      sessions.delete(userId);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`🧹 Limpiadas ${cleaned} sesiones expiradas de memoria`);
  }
  
  return cleaned;
}

// Obtener estadísticas
export function getSessionStats() {
  const now = new Date();
  const activeSessions = [];
  
  for (const [userId, session] of sessions.entries()) {
    if (now - session.lastActivity <= SESSION_TIMEOUT) {
      activeSessions.push({
        userId,
        dbUserId: session.user?.id,
        lastActivity: session.lastActivity,
        messageCount: session.conversationHistory?.length || 0
      });
    }
  }
  
  return {
    total: sessions.size,
    active: activeSessions.length,
    activeSessions
  };
}

// Inicializar limpieza automática
setInterval(cleanExpiredSessions, 10 * 60 * 1000); // Cada 10 minutos

console.log('🔄 User Manager inicializado (SQLite + Memory)');
console.log(`⏱️ Timeout de sesión: ${SESSION_TIMEOUT / 60000} minutos`);