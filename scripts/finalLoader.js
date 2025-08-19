// finalLoader.js - Script actualizado para cargar propiedades con estructura correcta
import { QdrantClient } from '@qdrant/js-client-rest';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Archivos de propiedades
const PROPERTY_FILES = [
  '/Users/gino/argyv2/scripts/postings_2_967_Propiedades_e_inmuebles_en_alquiler_en_Rosario_Santa_F__p1-99.json',
  '/Users/gino/argyv2/scripts/postings_15_352_Casas_o_Departamentos_o_PH_m_s_recientes_en_alquiler___p1-99.json'
];

const COLLECTION_NAME = 'properties';
const BATCH_SIZE = 10;
const EMBEDDING_MODEL = 'text-embedding-3-small';

// Usar configuración de producción
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

console.log('🔗 Conectando a Qdrant Cloud:', process.env.QDRANT_URL);
console.log('🤖 Usando OpenAI para embeddings');

// Contador global para generar IDs únicos
let globalIdCounter = 1;

// Función para limpiar string
function cleanString(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/\0/g, '').replace(/[\r\n\t]/g, ' ').trim().substring(0, 1000);
}

// Función para limpiar número
function cleanNumber(num) {
  if (num === null || num === undefined || num === '') return 0;
  const parsed = parseFloat(num);
  return isNaN(parsed) ? 0 : Math.max(0, parsed);
}

// Función para crear texto embedible
function createEmbeddingText(property) {
  const parts = [];
  
  // Usar el título real si existe
  if (property.title && property.title !== 'Sin título') {
    parts.push(cleanString(property.title));
  }
  if (property.generatedTitle) {
    parts.push(cleanString(property.generatedTitle));
  }
  
  const propertyType = property.realEstateType?.name;
  const location = property.postingLocation?.location?.name;
  if (propertyType || location) {
    parts.push(`${propertyType || 'Propiedad'} en ${location || 'zona'}`);
  }
  
  // Usar la dirección correcta
  if (property.postingLocation?.address?.name) {
    parts.push(cleanString(property.postingLocation.address.name));
  }
  
  const features = property.mainFeatures || {};
  if (features.CFT2?.value) parts.push(`${features.CFT2.value} dormitorios`);
  if (features.CFT3?.value) parts.push(`${features.CFT3.value} baños`);
  if (features.CFT100?.value) parts.push(`${features.CFT100.value}m²`);
  if (features.CFT7?.value) parts.push(`${features.CFT7.value} cocheras`);
  
  const price = property.priceOperationTypes?.[0]?.prices?.[0];
  if (price?.amount) {
    parts.push(`$${price.formattedAmount || price.amount} pesos`);
  }
  
  if (property.description) {
    parts.push(cleanString(property.description).substring(0, 300));
  }
  
  const text = parts.filter(Boolean).join(' | ');
  return text.substring(0, 2000);
}

// Función para extraer payload con estructura correcta
function extractPropertyPayload(property, sourceFile) {
  try {
    const price = property.priceOperationTypes?.[0]?.prices?.[0];
    const postingLocation = property.postingLocation || {};
    const location = postingLocation.location || {};
    const address = postingLocation.address || {};
    const mainFeatures = property.mainFeatures || {};
    const generalFeatures = property.generalFeatures || {};
    
    if (!property.postingId) {
      throw new Error('Missing postingId');
    }
    
    return {
      originalId: cleanString(property.postingId),
      postingCode: cleanString(property.postingCode),
      sourceFile: path.basename(sourceFile),
      
      // Usar el título real de la propiedad
      title: cleanString(property.title) || cleanString(property.generatedTitle) || 'Sin título',
      generatedTitle: cleanString(property.generatedTitle),
      description: cleanString(property.description),
      descriptionNormalized: cleanString(property.descriptionNormalized) || cleanString(property.description),
      
      price: cleanNumber(price?.amount),
      currency: cleanString(price?.currency) || 'ARS',
      priceFormatted: cleanString(price?.formattedAmount) || '0',
      expenses: cleanNumber(property.expenses?.amount),
      
      propertyType: cleanString(property.realEstateType?.name) || 'Sin especificar',
      propertyTypeId: cleanNumber(property.realEstateType?.realEstateTypeId),
      operationType: cleanString(property.priceOperationTypes?.[0]?.operationType?.name) || 'Alquiler',
      
      // Dirección correcta desde postingLocation.address.name
      address: cleanString(address.name) || 'Sin dirección',
      neighborhood: cleanString(location.name) || 'Sin especificar',
      city: cleanString(location.parent?.name) || 'Rosario',
      province: cleanString(location.parent?.parent?.name) || 'Santa Fe',
      latitude: cleanNumber(postingLocation.postingGeolocation?.geolocation?.latitude),
      longitude: cleanNumber(postingLocation.postingGeolocation?.geolocation?.longitude),
      
      totalArea: Math.floor(cleanNumber(mainFeatures.CFT100?.value)),
      coveredArea: Math.floor(cleanNumber(mainFeatures.CFT101?.value)),
      rooms: Math.floor(cleanNumber(mainFeatures.CFT1?.value)),
      bedrooms: Math.floor(cleanNumber(mainFeatures.CFT2?.value)),
      bathrooms: Math.floor(cleanNumber(mainFeatures.CFT3?.value)),
      garages: Math.floor(cleanNumber(mainFeatures.CFT7?.value)),
      
      hasBalcony: Boolean(generalFeatures.G14?.value === '1'),
      hasTerrace: Boolean(generalFeatures.G34?.value === '1'),
      hasGarden: Boolean(generalFeatures.G8?.value === '1'),
      hasPool: Boolean(generalFeatures.G1?.value === '1'),
      hasGym: Boolean(generalFeatures.G15?.value === '1'),
      hasSecurity: Boolean(generalFeatures.G36?.value === '1'),
      
      antiquity: cleanString(property.antiquity) || '',
      reserved: Boolean(property.reserved),
      
      publisher: cleanString(property.publisher?.name) || '',
      publisherPhone: cleanString(property.publisher?.mainPhone) || '',
      publisherId: cleanString(property.publisher?.publisherId) || '',
      
      url: property.url ? `https://www.zonaprop.com.ar${cleanString(property.url)}` : '',
      photos: Array.isArray(property.postingMultimedias) 
        ? property.postingMultimedias
            .map(m => cleanString(m.url))
            .filter(url => url.length > 0)
            .slice(0, 20)
        : [],
      photosCount: Array.isArray(property.postingMultimedias) ? property.postingMultimedias.length : 0,
      
      embeddingText: '',
      createdAt: cleanString(property.created_date) || new Date().toISOString(),
      scrapedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`Error procesando propiedad ${property.postingId}:`, error.message);
    return null;
  }
}

// Función para generar embeddings
async function generateEmbeddings(texts) {
  try {
    const validTexts = texts.map(text => {
      if (!text || typeof text !== 'string') return 'propiedad sin descripción';
      const cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ');
      return cleaned.substring(0, 8000);
    });
    
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: validTexts,
    });
    
    return response.data.map(item => item.embedding);
  } catch (error) {
    console.error('Error generando embeddings:', error);
    throw error;
  }
}

// Función principal
async function main() {
  console.log('🚀 Cargando propiedades en Qdrant Cloud con estructura corregida...\n');
  
  // Verificar conexión
  try {
    const collections = await qdrant.getCollections();
    console.log('✅ Conexión a Qdrant Cloud exitosa');
  } catch (error) {
    console.error('❌ Error conectando a Qdrant Cloud:', error.message);
    console.log('💡 Verifica QDRANT_URL y QDRANT_API_KEY en tu .env');
    process.exit(1);
  }
  
  // Verificar archivos
  console.log('\n📋 Verificando archivos:');
  for (const file of PROPERTY_FILES) {
    try {
      await fs.access(file);
      console.log(`   ✅ ${path.basename(file)}`);
    } catch (error) {
      console.log(`   ❌ ${path.basename(file)} (no encontrado)`);
    }
  }
  
  // Crear/recrear colección
  console.log('\n🗄️  Configurando colección en Qdrant Cloud...');
  
  try {
    await qdrant.deleteCollection(COLLECTION_NAME);
    console.log('   Colección anterior eliminada');
  } catch (e) {
    console.log('   No había colección previa');
  }
  
  await qdrant.createCollection(COLLECTION_NAME, {
    vectors: {
      size: 1536,
      distance: 'Cosine'
    }
  });
  
  console.log('✅ Colección creada en Qdrant Cloud');
  
  // Procesar archivos
  globalIdCounter = 1;
  let totalProcessed = 0;
  let totalErrors = 0;
  const allProperties = [];
  
  for (const filePath of PROPERTY_FILES) {
    console.log(`\n📂 Procesando: ${path.basename(filePath)}`);
    
    try {
      const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
      const properties = data.listPostings;
      console.log(`   📊 ${properties.length} propiedades encontradas`);
      
      for (const property of properties) {
        const payload = extractPropertyPayload(property, filePath);
        if (payload) {
          const embeddingText = createEmbeddingText(property);
          payload.embeddingText = embeddingText;
          allProperties.push({ payload, embeddingText });
        }
      }
      
    } catch (error) {
      console.error(`❌ Error procesando archivo:`, error.message);
    }
  }
  
  // Eliminar duplicados antes de cargar
  console.log(`\n🔄 Eliminando duplicados...`);
  const uniqueProperties = removeDuplicates(allProperties);
  console.log(`   ✅ ${uniqueProperties.length} propiedades únicas de ${allProperties.length} totales`);
  
  // Cargar en lotes
  console.log(`\n📤 Cargando propiedades únicas en Qdrant...`);
  
  for (let i = 0; i < uniqueProperties.length; i += BATCH_SIZE) {
    const batch = uniqueProperties.slice(i, i + BATCH_SIZE);
    console.log(`   📦 Lote ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(uniqueProperties.length/BATCH_SIZE)}`);
    
    try {
      const embeddingTexts = batch.map(item => item.embeddingText);
      const embeddings = await generateEmbeddings(embeddingTexts);
      
      const points = batch.map((item, idx) => ({
        id: globalIdCounter++,
        vector: embeddings[idx],
        payload: item.payload
      }));
      
      await qdrant.upsert(COLLECTION_NAME, {
        wait: true,
        points: points
      });
      
      totalProcessed += batch.length;
      console.log(`      ✅ ${totalProcessed} propiedades procesadas`);
      
    } catch (error) {
      console.error(`      ❌ Error en lote:`, error.message);
      totalErrors += batch.length;
    }
    
    // Pausa para no saturar
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Verificar resultado
  const collectionInfo = await qdrant.getCollection(COLLECTION_NAME);
  console.log('\n📊 Resumen final:');
  console.log(`   - Propiedades en Qdrant Cloud: ${collectionInfo.points_count}`);
  console.log(`   - Procesadas exitosamente: ${totalProcessed}`);
  console.log(`   - Errores: ${totalErrors}`);
  
  if (collectionInfo.points_count > 0) {
    console.log('\n✅ ¡Carga completada en Qdrant Cloud!');
    console.log('🤖 El bot ya puede buscar propiedades con direcciones correctas');
  } else {
    console.log('\n❌ No se cargaron propiedades.');
  }
}

// Función para eliminar duplicados
function removeDuplicates(properties) {
  const seen = new Map();
  const unique = [];
  
  for (const item of properties) {
    const property = item.payload;
    
    // Crear clave única basada en originalId, título y dirección
    const key1 = property.originalId || '';
    const key2 = `${property.title}_${property.address}_${property.price}`;
    
    // Si el originalId existe y ya lo vimos, es duplicado
    if (key1 && seen.has(key1)) {
      continue;
    }
    
    // Si la combinación título+dirección+precio ya existe, es probable duplicado
    if (seen.has(key2)) {
      continue;
    }
    
    // Marcar como visto
    if (key1) seen.set(key1, property);
    seen.set(key2, property);
    
    unique.push(item);
  }
  
  return unique;
}

main().catch(console.error);