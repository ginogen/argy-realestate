// databasePostgres.js - Configuración PostgreSQL para Render
import pkg from 'pg';
const { Pool } = pkg;

// Pool de conexiones
let pool = null;

// Inicializar conexión PostgreSQL
export function initializeDatabase() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
      console.error('❌ DATABASE_URL no configurada');
      return false;
    }

    pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    console.log('✅ Pool PostgreSQL inicializado');
  }

  return createTables();
}

// Crear tablas PostgreSQL
async function createTables() {
  try {
    // Tabla de usuarios
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        whatsapp_number VARCHAR(20) UNIQUE NOT NULL,
        first_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        total_searches INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'active'
      )
    `);

    // Tabla de preferencias
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        property_type VARCHAR(50),
        bedrooms INTEGER,
        bathrooms INTEGER,
        max_price INTEGER,
        min_price INTEGER,
        neighborhoods TEXT,
        features TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // Tabla de historial
    await pool.query(`
      CREATE TABLE IF NOT EXISTS search_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        query TEXT NOT NULL,
        filters TEXT,
        results_count INTEGER DEFAULT 0,
        clicked_properties TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // Tabla de favoritos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS saved_properties (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        property_id VARCHAR(255) NOT NULL,
        property_title TEXT,
        property_price VARCHAR(100),
        saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        UNIQUE(user_id, property_id)
      )
    `);

    // Índices
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_whatsapp ON users(whatsapp_number);
      CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id);
      CREATE INDEX IF NOT EXISTS idx_saved_properties_user ON saved_properties(user_id);
    `);

    console.log('✅ Tablas PostgreSQL creadas/verificadas');
    return true;

  } catch (error) {
    console.error('❌ Error creando tablas PostgreSQL:', error);
    return false;
  }
}

// Obtener pool
export function getDatabase() {
  return pool;
}

// Funciones adaptadas para PostgreSQL
export async function getOrCreateUser(whatsappNumber, firstName = null) {
  try {
    const cleanNumber = whatsappNumber.replace(/[^0-9]/g, '');
    
    // Buscar usuario existente
    const result = await pool.query(
      'SELECT * FROM users WHERE whatsapp_number = $1',
      [cleanNumber]
    );
    
    if (result.rows.length > 0) {
      // Actualizar actividad
      await pool.query(
        'UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = $1',
        [result.rows[0].id]
      );
      return result.rows[0];
    }
    
    // Crear nuevo usuario
    const insertResult = await pool.query(
      'INSERT INTO users (whatsapp_number, first_name) VALUES ($1, $2) RETURNING *',
      [cleanNumber, firstName]
    );
    
    console.log(`👤 Nuevo usuario creado: ${cleanNumber}`);
    return insertResult.rows[0];
    
  } catch (error) {
    console.error('❌ Error en getOrCreateUser:', error);
    return null;
  }
}

export async function getUserPreferences(userId) {
  try {
    const result = await pool.query(
      'SELECT * FROM user_preferences WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1',
      [userId]
    );
    
    if (result.rows.length === 0) return null;
    
    const prefs = result.rows[0];
    if (prefs.neighborhoods) {
      prefs.neighborhoods = JSON.parse(prefs.neighborhoods);
    }
    if (prefs.features) {
      prefs.features = JSON.parse(prefs.features);
    }
    
    return prefs;
  } catch (error) {
    console.error('❌ Error obteniendo preferencias:', error);
    return null;
  }
}

export async function saveUserPreferences(userId, preferences) {
  try {
    const neighborhoods = preferences.neighborhoods ? JSON.stringify(preferences.neighborhoods) : null;
    const features = preferences.features ? JSON.stringify(preferences.features) : null;
    
    // Eliminar preferencias anteriores
    await pool.query('DELETE FROM user_preferences WHERE user_id = $1', [userId]);
    
    // Insertar nuevas
    await pool.query(`
      INSERT INTO user_preferences 
      (user_id, property_type, bedrooms, bathrooms, max_price, min_price, neighborhoods, features)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      userId,
      preferences.property_type || null,
      preferences.bedrooms || null,
      preferences.bathrooms || null,
      preferences.max_price || null,
      preferences.min_price || null,
      neighborhoods,
      features
    ]);
    
    return true;
  } catch (error) {
    console.error('❌ Error guardando preferencias:', error);
    return false;
  }
}

export async function saveSearchHistory(userId, query, filters, resultsCount = 0) {
  try {
    await pool.query(
      'INSERT INTO search_history (user_id, query, filters, results_count) VALUES ($1, $2, $3, $4)',
      [userId, query, JSON.stringify(filters), resultsCount]
    );
    
    // Mantener solo 50 más recientes
    await pool.query(`
      DELETE FROM search_history 
      WHERE user_id = $1 AND id NOT IN (
        SELECT id FROM search_history 
        WHERE user_id = $1 
        ORDER BY created_at DESC 
        LIMIT 50
      )
    `, [userId]);
    
    return true;
  } catch (error) {
    console.error('❌ Error guardando historial:', error);
    return false;
  }
}

export async function getSearchHistory(userId, limit = 10) {
  try {
    const result = await pool.query(
      'SELECT * FROM search_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit]
    );
    
    return result.rows.map(item => ({
      ...item,
      filters: item.filters ? JSON.parse(item.filters) : {}
    }));
  } catch (error) {
    console.error('❌ Error obteniendo historial:', error);
    return [];
  }
}

export async function savePropertyAsFavorite(userId, propertyId, title = null, price = null) {
  try {
    await pool.query(`
      INSERT INTO saved_properties (user_id, property_id, property_title, property_price)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, property_id) DO UPDATE SET
      property_title = EXCLUDED.property_title,
      property_price = EXCLUDED.property_price,
      saved_at = CURRENT_TIMESTAMP
    `, [userId, propertyId, title, price]);
    
    return true;
  } catch (error) {
    console.error('❌ Error guardando favorito:', error);
    return false;
  }
}

export async function getUserFavorites(userId) {
  try {
    const result = await pool.query(
      'SELECT * FROM saved_properties WHERE user_id = $1 ORDER BY saved_at DESC',
      [userId]
    );
    return result.rows;
  } catch (error) {
    console.error('❌ Error obteniendo favoritos:', error);
    return [];
  }
}

export async function updateUser(userId, updates) {
  try {
    const fields = Object.keys(updates).map((key, index) => `${key} = $${index + 2}`).join(', ');
    const values = Object.values(updates);
    
    await pool.query(`
      UPDATE users SET ${fields}, last_activity = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [userId, ...values]);
    
    return true;
  } catch (error) {
    console.error('❌ Error actualizando usuario:', error);
    return false;
  }
}

export async function incrementUserSearches(userId) {
  try {
    await pool.query(
      'UPDATE users SET total_searches = total_searches + 1, last_activity = CURRENT_TIMESTAMP WHERE id = $1',
      [userId]
    );
    return true;
  } catch (error) {
    console.error('❌ Error incrementando búsquedas:', error);
    return false;
  }
}

export async function removeFavorite(userId, propertyId) {
  try {
    const result = await pool.query(
      'DELETE FROM saved_properties WHERE user_id = $1 AND property_id = $2',
      [userId, propertyId]
    );
    return result.rowCount > 0;
  } catch (error) {
    console.error('❌ Error eliminando favorito:', error);
    return false;
  }
}

// Cleanup
export function closeDatabase() {
  if (pool) {
    pool.end();
    pool = null;
    console.log('🔒 Pool PostgreSQL cerrado');
  }
}

process.on('SIGINT', closeDatabase);
process.on('SIGTERM', closeDatabase);