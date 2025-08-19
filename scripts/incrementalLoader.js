// incrementalLoader.js - Carga incremental de propiedades sin borrar colección existente
import { QdrantClient } from '@qdrant/js-client-rest';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const COLLECTION_NAME = 'properties';
const BATCH_SIZE = 50;
const EMBEDDING_MODEL = 'text-embedding-3-small';

// Configuración de Qdrant Cloud
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

console.log('🔗 Conectando a Qdrant Cloud:', process.env.QDRANT_URL);
console.log('🤖 Usando OpenAI para embeddings');

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

// Función para extraer payload
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
      photos: Array.isArray(property.visiblePictures?.pictures) 
        ? property.visiblePictures.pictures
            .filter(m => m.multimediaTypeId === "2")
            .map(m => cleanString(m.url730x532) || cleanString(m.url360x266))
            .filter(url => url.length > 0)
            .slice(0, 20)
        : Array.isArray(property.multimediaArray) 
          ? property.multimediaArray
              .filter(m => m.multimediaTypeId === "2")
              .map(m => cleanString(m.url730x532) || cleanString(m.url360x266))
              .filter(url => url.length > 0)
              .slice(0, 20)
          : [],
      photosCount: Array.isArray(property.visiblePictures?.pictures) 
        ? property.visiblePictures.pictures.filter(m => m.multimediaTypeId === "2").length 
        : Array.isArray(property.multimediaArray) 
          ? property.multimediaArray.filter(m => m.multimediaTypeId === "2").length
          : 0,
      
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

// Función para obtener propiedades existentes en Qdrant
async function getExistingProperties() {
  try {
    const existing = new Set();
    let offset = 0;
    const limit = 1000;
    
    while (true) {
      const scrollResult = await qdrant.scroll(COLLECTION_NAME, {
        limit: limit,
        offset: offset,
        with_payload: ["originalId"]
      });
      
      if (scrollResult.points.length === 0) break;
      
      for (const point of scrollResult.points) {
        if (point.payload?.originalId) {
          existing.add(point.payload.originalId);
        }
      }
      
      offset += limit;
      
      if (scrollResult.points.length < limit) break;
    }
    
    return existing;
  } catch (error) {
    console.error('Error obteniendo propiedades existentes:', error);
    return new Set();
  }
}

// Función para obtener siguiente ID disponible
async function getNextId() {
  try {
    const collectionInfo = await qdrant.getCollection(COLLECTION_NAME);
    return (collectionInfo.points_count || 0) + 1;
  } catch (error) {
    return 1;
  }
}

// Función para procesar archivos JSON
async function processJsonFiles(filePaths) {
  const results = {
    processed: 0,
    added: 0,
    skipped: 0,
    errors: 0
  };
  
  console.log('🔍 Obteniendo propiedades existentes...');
  const existingProperties = await getExistingProperties();
  console.log(`   📊 ${existingProperties.size} propiedades ya existen en Qdrant`);
  
  let globalIdCounter = await getNextId();
  const allNewProperties = [];
  
  for (const filePath of filePaths) {
    console.log(`\n📂 Procesando: ${path.basename(filePath)}`);
    
    try {
      const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
      const properties = data.listPostings || data.properties || data;
      
      if (!Array.isArray(properties)) {
        console.log(`   ❌ Formato de archivo inválido: esperaba array de propiedades`);
        continue;
      }
      
      console.log(`   📊 ${properties.length} propiedades encontradas en archivo`);
      
      for (const property of properties) {
        results.processed++;
        
        const payload = extractPropertyPayload(property, filePath);
        if (!payload) {
          results.errors++;
          continue;
        }
        
        // Verificar si ya existe
        if (existingProperties.has(payload.originalId)) {
          results.skipped++;
          console.log(`   ⏭️  Saltando propiedad existente: ${payload.originalId}`);
          continue;
        }
        
        const embeddingText = createEmbeddingText(property);
        payload.embeddingText = embeddingText;
        
        allNewProperties.push({ payload, embeddingText });
        results.added++;
      }
      
    } catch (error) {
      console.error(`   ❌ Error procesando archivo:`, error.message);
    }
  }
  
  // Cargar propiedades nuevas en lotes
  if (allNewProperties.length > 0) {
    console.log(`\n📤 Cargando ${allNewProperties.length} propiedades nuevas en Qdrant...`);
    
    for (let i = 0; i < allNewProperties.length; i += BATCH_SIZE) {
      const batch = allNewProperties.slice(i, i + BATCH_SIZE);
      console.log(`   📦 Lote ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(allNewProperties.length/BATCH_SIZE)} (${batch.length} propiedades)`);
      
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
        
        console.log(`      ✅ Lote cargado exitosamente`);
        
      } catch (error) {
        console.error(`      ❌ Error en lote:`, error.message);
        results.errors += batch.length;
        results.added -= batch.length;
      }
      
      // Pausa para no saturar
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

// Función principal
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
🔧 Uso del cargador incremental:

  node scripts/incrementalLoader.js <archivo1.json> [archivo2.json] [...]
  
📋 Ejemplos:
  node scripts/incrementalLoader.js nuevas_propiedades.json
  node scripts/incrementalLoader.js data/*.json
  node scripts/incrementalLoader.js archivo1.json archivo2.json

💡 Este script mantiene las propiedades existentes y solo agrega las nuevas.
`);
    process.exit(0);
  }
  
  console.log('🚀 Carga incremental de propiedades en Qdrant Cloud...\n');
  
  // Verificar conexión a Qdrant
  try {
    const collections = await qdrant.getCollections();
    console.log('✅ Conexión a Qdrant Cloud exitosa');
    
    // Verificar si existe la colección
    const collectionExists = collections.collections.some(c => c.name === COLLECTION_NAME);
    if (!collectionExists) {
      console.log(`\n❌ La colección '${COLLECTION_NAME}' no existe.`);
      console.log('💡 Primero ejecuta el script completo para crear la colección:');
      console.log('   node scripts/finalLoader.js');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error conectando a Qdrant Cloud:', error.message);
    console.log('💡 Verifica QDRANT_URL y QDRANT_API_KEY en tu .env');
    process.exit(1);
  }
  
  // Verificar archivos JSON
  const validFiles = [];
  console.log('\n📋 Verificando archivos:');
  
  for (const file of args) {
    try {
      const fullPath = path.isAbsolute(file) ? file : path.join(__dirname, file);
      await fs.access(fullPath);
      validFiles.push(fullPath);
      console.log(`   ✅ ${path.basename(fullPath)}`);
    } catch (error) {
      console.log(`   ❌ ${file} (no encontrado)`);
    }
  }
  
  if (validFiles.length === 0) {
    console.log('\n❌ No se encontraron archivos JSON válidos.');
    process.exit(1);
  }
  
  // Procesar archivos
  const results = await processJsonFiles(validFiles);
  
  // Verificar resultado final
  const collectionInfo = await qdrant.getCollection(COLLECTION_NAME);
  
  console.log('\n📊 Resumen final:');
  console.log(`   - Total propiedades en Qdrant: ${collectionInfo.points_count}`);
  console.log(`   - Propiedades procesadas: ${results.processed}`);
  console.log(`   - Propiedades agregadas: ${results.added}`);
  console.log(`   - Propiedades saltadas (existentes): ${results.skipped}`);
  console.log(`   - Errores: ${results.errors}`);
  
  if (results.added > 0) {
    console.log(`\n✅ ¡Carga incremental completada!`);
    console.log(`🤖 Se agregaron ${results.added} propiedades nuevas al bot`);
  } else if (results.skipped > 0) {
    console.log('\n💡 No había propiedades nuevas que agregar.');
    console.log('   Todas las propiedades ya existían en la base de datos.');
  } else {
    console.log('\n❌ No se agregaron propiedades.');
  }
}

main().catch(console.error);