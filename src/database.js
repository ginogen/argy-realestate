// database.js - Configuración y funciones de base de datos SQLite
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta del archivo de base de datos
const DB_PATH = process.env.NODE_ENV === 'production' 
  ? '/opt/render/project/src/data/users.db'  // Render persistent disk
  : path.join(__dirname, '..', 'data', 'users.db');

// Instancia de base de datos (singleton)
let db = null;
let dbInitialized = false;

// Inicializar base de datos
export function initializeDatabase() {
  try {
    console.log(`📄 Inicializando base de datos SQLite: ${DB_PATH}`);
    
    // Crear conexión
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL'); // Mejor rendimiento
    
    // Crear tablas si no existen
    createTables();
    
    console.log('✅ Base de datos SQLite inicializada correctamente');
    dbInitialized = true;
    return true;
  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error);
    console.log('⚠️  El sistema funcionará solo con memoria temporal');
    console.log('ℹ️  Funciones disponibles: búsqueda, detalles, fotos (contexto se mantiene durante la sesión)');
    console.log('ℹ️  Funciones no disponibles: favoritos, historial, preferencias persistentes');
    dbInitialized = false;
    return false;
  }
}

// Crear tablas
function createTables() {
  // Tabla de usuarios
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      whatsapp_number TEXT UNIQUE NOT NULL,
      first_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_searches INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active'
    )
  `);

  // Tabla de preferencias del usuario
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      property_type TEXT,
      bedrooms INTEGER,
      bathrooms INTEGER,
      max_price INTEGER,
      min_price INTEGER,
      neighborhoods TEXT, -- JSON array
      features TEXT, -- JSON array
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Historial de búsquedas
  db.exec(`
    CREATE TABLE IF NOT EXISTS search_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      query TEXT NOT NULL,
      filters TEXT, -- JSON
      results_count INTEGER DEFAULT 0,
      clicked_properties TEXT, -- JSON array
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Propiedades guardadas/favoritas
  db.exec(`
    CREATE TABLE IF NOT EXISTS saved_properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      property_id TEXT NOT NULL, -- originalId de Qdrant
      property_title TEXT,
      property_price TEXT,
      saved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      UNIQUE(user_id, property_id)
    )
  `);

  // Crear índices para mejor rendimiento
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_whatsapp ON users(whatsapp_number);
    CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id);
    CREATE INDEX IF NOT EXISTS idx_saved_properties_user ON saved_properties(user_id);
    CREATE INDEX IF NOT EXISTS idx_users_activity ON users(last_activity);
  `);

  console.log('📋 Tablas de base de datos creadas/verificadas');
}

// Obtener conexión de base de datos
export function getDatabase() {
  if (!db && !dbInitialized) {
    initializeDatabase();
  }
  return db;
}

// Verificar si la base de datos está disponible
export function isDatabaseAvailable() {
  return dbInitialized && db !== null;
}

// Cerrar conexión (para cleanup)
export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log('🔒 Base de datos cerrada');
  }
}

// === FUNCIONES DE USUARIOS ===

// Crear o obtener usuario
export function getOrCreateUser(whatsappNumber, firstName = null) {
  const database = getDatabase();
  
  if (!isDatabaseAvailable()) {
    console.log('⚠️  SQLite no disponible, usando datos temporales');
    // Retornar usuario temporal para mantener funcionamiento
    const cleanNumber = whatsappNumber.replace(/[^0-9]/g, '');
    return {
      id: cleanNumber, // Usar número como ID temporal
      whatsapp_number: cleanNumber,
      first_name: firstName,
      created_at: new Date().toISOString(),
      last_activity: new Date().toISOString(),
      total_searches: 0,
      status: 'active'
    };
  }
  
  try {
    // Limpiar número de WhatsApp (solo dígitos)
    const cleanNumber = whatsappNumber.replace(/[^0-9]/g, '');
    
    // Buscar usuario existente
    const existingUser = database.prepare(`
      SELECT * FROM users WHERE whatsapp_number = ?
    `).get(cleanNumber);
    
    if (existingUser) {
      // Actualizar última actividad
      database.prepare(`
        UPDATE users SET last_activity = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(existingUser.id);
      
      return existingUser;
    }
    
    // Crear nuevo usuario
    const result = database.prepare(`
      INSERT INTO users (whatsapp_number, first_name)
      VALUES (?, ?)
    `).run(cleanNumber, firstName);
    
    // Retornar usuario creado
    const newUser = database.prepare(`
      SELECT * FROM users WHERE id = ?
    `).get(result.lastInsertRowid);
    
    console.log(`👤 Nuevo usuario creado: ${cleanNumber} (ID: ${newUser.id})`);
    return newUser;
    
  } catch (error) {
    console.error('❌ Error en getOrCreateUser:', error);
    return null;
  }
}

// Actualizar información del usuario
export function updateUser(userId, updates) {
  const database = getDatabase();
  
  try {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    
    const result = database.prepare(`
      UPDATE users SET ${fields}, last_activity = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(...values, userId);
    
    return result.changes > 0;
  } catch (error) {
    console.error('❌ Error actualizando usuario:', error);
    return false;
  }
}

// Incrementar contador de búsquedas
export function incrementUserSearches(userId) {
  if (!isDatabaseAvailable()) {
    return false; // Sin SQLite, no se puede incrementar
  }
  
  const database = getDatabase();
  
  try {
    database.prepare(`
      UPDATE users SET 
        total_searches = total_searches + 1,
        last_activity = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(userId);
    
    return true;
  } catch (error) {
    console.error('❌ Error incrementando búsquedas:', error);
    return false;
  }
}

// === FUNCIONES DE PREFERENCIAS ===

// Obtener preferencias del usuario
export function getUserPreferences(userId) {
  if (!isDatabaseAvailable()) {
    return null; // Sin SQLite, no hay preferencias persistentes
  }
  
  const database = getDatabase();
  
  try {
    const prefs = database.prepare(`
      SELECT * FROM user_preferences WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1
    `).get(userId);
    
    if (prefs) {
      // Parsear JSON fields de forma segura
      if (prefs.neighborhoods) {
        try {
          prefs.neighborhoods = JSON.parse(prefs.neighborhoods);
          // Si no es array, convertirlo
          if (!Array.isArray(prefs.neighborhoods)) {
            prefs.neighborhoods = [prefs.neighborhoods];
          }
        } catch (error) {
          // Si no es JSON válido, tratarlo como string simple
          console.log(`🔧 Convirtiendo neighborhood string a array: "${prefs.neighborhoods}"`);
          prefs.neighborhoods = [prefs.neighborhoods];
        }
      }
      if (prefs.features) {
        try {
          prefs.features = JSON.parse(prefs.features);
        } catch (error) {
          console.log(`🔧 Error parseando features: "${prefs.features}"`);
          prefs.features = [];
        }
      }
    }
    
    return prefs;
  } catch (error) {
    console.error('❌ Error obteniendo preferencias:', error);
    return null;
  }
}

// Guardar/actualizar preferencias del usuario
export function saveUserPreferences(userId, preferences) {
  if (!isDatabaseAvailable()) {
    console.log('⚠️  SQLite no disponible, preferencias no se guardarán');
    return false;
  }
  
  const database = getDatabase();
  
  try {
    // Convertir arrays a JSON
    const neighborhoods = preferences.neighborhoods ? JSON.stringify(preferences.neighborhoods) : null;
    const features = preferences.features ? JSON.stringify(preferences.features) : null;
    
    // Eliminar preferencias anteriores
    database.prepare('DELETE FROM user_preferences WHERE user_id = ?').run(userId);
    
    // Insertar nuevas preferencias
    const result = database.prepare(`
      INSERT INTO user_preferences 
      (user_id, property_type, bedrooms, bathrooms, max_price, min_price, neighborhoods, features)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      preferences.property_type || null,
      preferences.bedrooms || null,
      preferences.bathrooms || null,
      preferences.max_price || null,
      preferences.min_price || null,
      neighborhoods,
      features
    );
    
    console.log(`💾 Preferencias guardadas para usuario ${userId}`);
    return result.lastInsertRowid;
  } catch (error) {
    console.error('❌ Error guardando preferencias:', error);
    return false;
  }
}

// === FUNCIONES DE HISTORIAL ===

// Guardar búsqueda en historial
export function saveSearchHistory(userId, query, filters, resultsCount = 0) {
  if (!isDatabaseAvailable()) {
    console.log('⚠️  SQLite no disponible, historial no se guardará');
    return false;
  }
  
  const database = getDatabase();
  
  try {
    const result = database.prepare(`
      INSERT INTO search_history (user_id, query, filters, results_count)
      VALUES (?, ?, ?, ?)
    `).run(userId, query, JSON.stringify(filters), resultsCount);
    
    // Mantener solo las últimas 50 búsquedas por usuario
    database.prepare(`
      DELETE FROM search_history 
      WHERE user_id = ? AND id NOT IN (
        SELECT id FROM search_history 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 50
      )
    `).run(userId, userId);
    
    return result.lastInsertRowid;
  } catch (error) {
    console.error('❌ Error guardando historial:', error);
    return false;
  }
}

// Obtener historial de búsquedas
export function getSearchHistory(userId, limit = 10) {
  if (!isDatabaseAvailable()) {
    return []; // Sin SQLite, no hay historial
  }
  
  const database = getDatabase();
  
  try {
    const history = database.prepare(`
      SELECT * FROM search_history 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(userId, limit);
    
    // Parsear JSON filters
    return history.map(item => ({
      ...item,
      filters: item.filters ? JSON.parse(item.filters) : {}
    }));
  } catch (error) {
    console.error('❌ Error obteniendo historial:', error);
    return [];
  }
}

// === FUNCIONES DE FAVORITOS ===

// Guardar propiedad como favorita
export function savePropertyAsFavorite(userId, propertyId, title = null, price = null) {
  if (!isDatabaseAvailable()) {
    console.log('⚠️  SQLite no disponible, favorito no se guardará');
    return false;
  }
  
  const database = getDatabase();
  
  try {
    const result = database.prepare(`
      INSERT OR REPLACE INTO saved_properties 
      (user_id, property_id, property_title, property_price)
      VALUES (?, ?, ?, ?)
    `).run(userId, propertyId, title, price);
    
    console.log(`⭐ Propiedad ${propertyId} guardada como favorita para usuario ${userId}`);
    return result.lastInsertRowid;
  } catch (error) {
    console.error('❌ Error guardando favorito:', error);
    return false;
  }
}

// Obtener propiedades favoritas
export function getUserFavorites(userId) {
  if (!isDatabaseAvailable()) {
    return []; // Sin SQLite, no hay favoritos
  }
  
  const database = getDatabase();
  
  try {
    return database.prepare(`
      SELECT * FROM saved_properties 
      WHERE user_id = ? 
      ORDER BY saved_at DESC
    `).all(userId);
  } catch (error) {
    console.error('❌ Error obteniendo favoritos:', error);
    return [];
  }
}

// Eliminar favorito
export function removeFavorite(userId, propertyId) {
  if (!isDatabaseAvailable()) {
    return false; // Sin SQLite, no se puede eliminar
  }
  
  const database = getDatabase();
  
  try {
    const result = database.prepare(`
      DELETE FROM saved_properties 
      WHERE user_id = ? AND property_id = ?
    `).run(userId, propertyId);
    
    return result.changes > 0;
  } catch (error) {
    console.error('❌ Error eliminando favorito:', error);
    return false;
  }
}

// === FUNCIONES DE ESTADÍSTICAS ===

// Obtener estadísticas de la base de datos
export function getDatabaseStats() {
  const database = getDatabase();
  
  try {
    const stats = {
      totalUsers: database.prepare('SELECT COUNT(*) as count FROM users').get().count,
      activeUsers: database.prepare("SELECT COUNT(*) as count FROM users WHERE last_activity > datetime('now', '-7 days')").get().count,
      totalSearches: database.prepare('SELECT SUM(total_searches) as total FROM users').get().total || 0,
      totalFavorites: database.prepare('SELECT COUNT(*) as count FROM saved_properties').get().count,
      recentSearches: database.prepare("SELECT COUNT(*) as count FROM search_history WHERE created_at > datetime('now', '-24 hours')").get().count
    };
    
    return stats;
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    return null;
  }
}

// Inicialización automática cuando se importa el módulo
process.on('SIGINT', closeDatabase);
process.on('SIGTERM', closeDatabase);