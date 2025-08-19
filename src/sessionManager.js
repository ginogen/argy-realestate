// sessionManager.js - Manejo de sesiones y contexto de usuarios
import dotenv from 'dotenv';

dotenv.config();

// Store en memoria para sesiones (en producción usar Redis)
const sessions = new Map();

const SESSION_TIMEOUT = (process.env.SESSION_TIMEOUT_MINUTES || 30) * 60 * 1000; // 30 minutos por defecto

// Estructura de sesión
function createSession(userId) {
  return {
    userId,
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

// Obtener sesión del usuario
export function getSession(userId) {
  const cleanUserId = userId.replace(/[^0-9]/g, '');
  
  let session = sessions.get(cleanUserId);
  
  if (!session) {
    console.log(`👤 Nueva sesión creada para usuario: ${cleanUserId}`);
    session = createSession(cleanUserId);
    sessions.set(cleanUserId, session);
  } else {
    // Verificar si la sesión expiró
    const now = new Date();
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      console.log(`⏱️ Sesión expirada para usuario: ${cleanUserId}, creando nueva`);
      session = createSession(cleanUserId);
      sessions.set(cleanUserId, session);
    } else {
      session.lastActivity = now;
    }
  }
  
  return session;
}

// Actualizar sesión
export function updateSession(userId, updates) {
  const cleanUserId = userId.replace(/[^0-9]/g, '');
  const session = sessions.get(cleanUserId);
  
  if (!session) {
    console.error(`❌ Sesión no encontrada para usuario: ${cleanUserId}`);
    return;
  }
  
  // Actualizar campos
  Object.keys(updates).forEach(key => {
    if (key === 'conversationHistory') {
      // Agregar al historial en lugar de reemplazar
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
  
  console.log(`📝 Sesión actualizada para usuario: ${cleanUserId}`);
}

// Agregar mensaje al historial
export function addToConversationHistory(userId, type, content) {
  const cleanUserId = userId.replace(/[^0-9]/g, '');
  const session = sessions.get(cleanUserId);
  
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

// Obtener historial de conversación
export function getConversationHistory(userId, limit = 10) {
  const cleanUserId = userId.replace(/[^0-9]/g, '');
  const session = sessions.get(cleanUserId);
  
  if (!session || !session.conversationHistory) {
    return [];
  }
  
  return session.conversationHistory.slice(-limit);
}

// Obtener contexto resumido para IA
export function getContextForAI(userId) {
  const cleanUserId = userId.replace(/[^0-9]/g, '');
  const session = sessions.get(cleanUserId);
  
  if (!session) return {};
  
  return {
    lastQuery: session.lastQuery,
    lastFilters: session.lastFilters,
    preferences: session.preferences,
    recentSearches: session.conversationHistory
      .filter(entry => entry.type === 'user')
      .slice(-3)
      .map(entry => entry.content)
  };
}

// Actualizar preferencias del usuario
export function updateUserPreferences(userId, preferences) {
  const cleanUserId = userId.replace(/[^0-9]/g, '');
  const session = sessions.get(cleanUserId);
  
  if (!session) return;
  
  // Mergear preferencias
  session.preferences = {
    ...session.preferences,
    ...preferences
  };
  
  session.lastActivity = new Date();
  
  console.log(`👤 Preferencias actualizadas para usuario: ${cleanUserId}`, session.preferences);
}

// Aprender de las búsquedas del usuario
export function learnFromUserBehavior(userId, searchFilters, selectedProperties = []) {
  const cleanUserId = userId.replace(/[^0-9]/g, '');
  const session = sessions.get(cleanUserId);
  
  if (!session) return;
  
  const preferences = session.preferences;
  
  // Aprender precio preferido
  if (searchFilters.priceMax) {
    if (!preferences.maxPrice || searchFilters.priceMax < preferences.maxPrice) {
      preferences.maxPrice = searchFilters.priceMax;
    }
  }
  
  // Aprender barrios preferidos
  if (searchFilters.neighborhood) {
    if (!preferences.preferredNeighborhoods.includes(searchFilters.neighborhood)) {
      preferences.preferredNeighborhoods.push(searchFilters.neighborhood);
      
      // Mantener solo 5 barrios más buscados
      if (preferences.preferredNeighborhoods.length > 5) {
        preferences.preferredNeighborhoods = preferences.preferredNeighborhoods.slice(-5);
      }
    }
  }
  
  // Aprender tipo de propiedad preferido
  if (searchFilters.propertyType) {
    if (!preferences.preferredPropertyTypes.includes(searchFilters.propertyType)) {
      preferences.preferredPropertyTypes.push(searchFilters.propertyType);
    }
  }
  
  // Aprender dormitorios mínimos
  if (searchFilters.bedrooms) {
    if (!preferences.minBedrooms || searchFilters.bedrooms > preferences.minBedrooms) {
      preferences.minBedrooms = searchFilters.bedrooms;
    }
  }
  
  // Aprender de propiedades seleccionadas para ver detalles
  selectedProperties.forEach(property => {
    if (property.neighborhood && !preferences.preferredNeighborhoods.includes(property.neighborhood)) {
      preferences.preferredNeighborhoods.push(property.neighborhood);
    }
  });
  
  session.lastActivity = new Date();
  
  console.log(`🧠 Aprendizaje actualizado para usuario: ${cleanUserId}`);
}

// Limpiar sesiones expiradas
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
    console.log(`🧹 Limpiadas ${cleaned} sesiones expiradas`);
  }
  
  return cleaned;
}

// Obtener estadísticas de sesiones
export function getSessionStats() {
  const now = new Date();
  const activeSessions = [];
  const expiredSessions = [];
  
  for (const [userId, session] of sessions.entries()) {
    if (now - session.lastActivity <= SESSION_TIMEOUT) {
      activeSessions.push({
        userId,
        lastActivity: session.lastActivity,
        messageCount: session.conversationHistory?.length || 0
      });
    } else {
      expiredSessions.push(userId);
    }
  }
  
  return {
    total: sessions.size,
    active: activeSessions.length,
    expired: expiredSessions.length,
    activeSessions
  };
}

// Eliminar sesión específica
export function deleteSession(userId) {
  const cleanUserId = userId.replace(/[^0-9]/g, '');
  const deleted = sessions.delete(cleanUserId);
  
  if (deleted) {
    console.log(`🗑️ Sesión eliminada para usuario: ${cleanUserId}`);
  }
  
  return deleted;
}

// Inicializar limpieza automática de sesiones
setInterval(() => {
  cleanExpiredSessions();
}, 10 * 60 * 1000); // Limpiar cada 10 minutos

console.log('🔄 Session Manager inicializado');
console.log(`⏱️ Timeout de sesión: ${SESSION_TIMEOUT / 60000} minutos`);