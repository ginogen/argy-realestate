// config/database.js - Configuración de conexiones a bases de datos
import { QdrantClient } from '@qdrant/js-client-rest';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// Configuración de Qdrant
export const qdrantConfig = {
  url: process.env.QDRANT_URL || 'http://localhost:6333',
  apiKey: process.env.QDRANT_API_KEY
};

// Configuración de OpenAI
export const openaiConfig = {
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG_ID
};

// Cliente Qdrant singleton
let qdrantClient = null;
export function getQdrantClient() {
  if (!qdrantClient) {
    qdrantClient = new QdrantClient(qdrantConfig);
  }
  return qdrantClient;
}

// Cliente OpenAI singleton
let openaiClient = null;
export function getOpenAIClient() {
  if (!openaiClient) {
    openaiClient = new OpenAI(openaiConfig);
  }
  return openaiClient;
}

// Configuración de la colección de propiedades
export const PROPERTIES_COLLECTION = {
  name: 'properties',
  vectors: {
    size: 1536, // text-embedding-3-small
    distance: 'Cosine'
  },
  optimizers_config: {
    default_segment_number: 2
  },
  replication_factor: 2
};

// Verificar conexiones
export async function verifyConnections() {
  const results = {
    qdrant: false,
    openai: false,
    errors: []
  };
  
  // Verificar Qdrant
  try {
    const qdrant = getQdrantClient();
    const collections = await qdrant.getCollections();
    results.qdrant = true;
    console.log('✅ Qdrant conectado correctamente');
  } catch (error) {
    results.errors.push(`Qdrant: ${error.message}`);
    console.error('❌ Error conectando a Qdrant:', error.message);
  }
  
  // Verificar OpenAI
  try {
    const openai = getOpenAIClient();
    const models = await openai.models.list();
    results.openai = true;
    console.log('✅ OpenAI conectado correctamente');
  } catch (error) {
    results.errors.push(`OpenAI: ${error.message}`);
    console.error('❌ Error conectando a OpenAI:', error.message);
  }
  
  return results;
}

// Inicializar base de datos
export async function initializeDatabase() {
  try {
    const qdrant = getQdrantClient();
    
    // Verificar si la colección existe
    try {
      const collection = await qdrant.getCollection(PROPERTIES_COLLECTION.name);
      console.log(`✅ Colección '${PROPERTIES_COLLECTION.name}' encontrada con ${collection.points_count} propiedades`);
    } catch (error) {
      console.log(`⚠️  Colección '${PROPERTIES_COLLECTION.name}' no encontrada`);
      console.log('📝 Para cargar datos, ejecuta: npm run load-data');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error);
    return false;
  }
}