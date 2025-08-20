// Migración para corregir neighborhoods corruptos en la base de datos
import { pool } from '../databasePostgres.js';

async function migrateNeighborhoods() {
  try {
    console.log('🔄 Iniciando migración de neighborhoods...');
    
    // Obtener todas las preferencias con neighborhoods
    const result = await pool.query(
      'SELECT id, user_id, neighborhoods FROM user_preferences WHERE neighborhoods IS NOT NULL'
    );
    
    console.log(`📊 Encontradas ${result.rows.length} preferencias con neighborhoods`);
    
    let migratedCount = 0;
    let skippedCount = 0;
    
    for (const row of result.rows) {
      const { id, user_id, neighborhoods } = row;
      
      try {
        // Intentar parsear como JSON
        const parsed = JSON.parse(neighborhoods);
        if (Array.isArray(parsed)) {
          console.log(`✅ ID ${id} (usuario ${user_id}): Ya es JSON válido`);
          skippedCount++;
          continue;
        }
      } catch (error) {
        // Si no es JSON válido, convertirlo a array
        console.log(`🔧 ID ${id} (usuario ${user_id}): Convirtiendo "${neighborhoods}" → ["${neighborhoods}"]`);
        
        const fixedNeighborhoods = JSON.stringify([neighborhoods]);
        
        await pool.query(
          'UPDATE user_preferences SET neighborhoods = $1 WHERE id = $2',
          [fixedNeighborhoods, id]
        );
        
        migratedCount++;
      }
    }
    
    console.log(`✅ Migración completada:`);
    console.log(`   🔧 Migrados: ${migratedCount}`);
    console.log(`   ⏭️  Omitidos (ya válidos): ${skippedCount}`);
    
  } catch (error) {
    console.error('❌ Error en migración:', error);
  }
}

// Función para verificar el estado actual
async function checkNeighborhoodsStatus() {
  try {
    const result = await pool.query(
      'SELECT id, user_id, neighborhoods FROM user_preferences WHERE neighborhoods IS NOT NULL'
    );
    
    console.log('\n📊 Estado actual de neighborhoods:');
    
    let validCount = 0;
    let invalidCount = 0;
    
    for (const row of result.rows) {
      const { id, user_id, neighborhoods } = row;
      
      try {
        const parsed = JSON.parse(neighborhoods);
        if (Array.isArray(parsed)) {
          console.log(`✅ ID ${id}: ${JSON.stringify(parsed)}`);
          validCount++;
        } else {
          console.log(`⚠️  ID ${id}: ${neighborhoods} (no es array)`);
          invalidCount++;
        }
      } catch (error) {
        console.log(`❌ ID ${id}: "${neighborhoods}" (JSON inválido)`);
        invalidCount++;
      }
    }
    
    console.log(`\n📈 Resumen: ${validCount} válidos, ${invalidCount} inválidos`);
    
  } catch (error) {
    console.error('❌ Error verificando estado:', error);
  }
}

// Ejecutar según argumentos de línea de comandos
const command = process.argv[2];

if (command === 'check') {
  await checkNeighborhoodsStatus();
} else if (command === 'migrate') {
  await migrateNeighborhoods();
} else {
  console.log('📋 Uso:');
  console.log('  node migrateNeighborhoods.js check   - Verificar estado actual');
  console.log('  node migrateNeighborhoods.js migrate - Ejecutar migración');
}

process.exit(0);