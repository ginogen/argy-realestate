import fs from 'fs';

const data1 = JSON.parse(fs.readFileSync('postings_2_967_Propiedades_e_inmuebles_en_alquiler_en_Rosario_Santa_F__p1-99.json', 'utf8'));
const data2 = JSON.parse(fs.readFileSync('postings_15_352_Casas_o_Departamentos_o_PH_m_s_recientes_en_alquiler___p1-99.json', 'utf8'));

const ids1 = new Set(data1.listPostings.map(p => p.postingId));
const ids2 = new Set(data2.listPostings.map(p => p.postingId));

const solo_archivo1 = [...ids1].filter(id => !ids2.has(id));
const solo_archivo2 = [...ids2].filter(id => !ids1.has(id));

console.log('Propiedades SOLO en archivo 1:', solo_archivo1.length);
console.log('Propiedades SOLO en archivo 2:', solo_archivo2.length);

console.log('\nResumen:');
console.log('- Propiedades duplicadas (mismo ID):', ids1.size - solo_archivo1.length);
console.log('- Propiedades únicas archivo 1:', solo_archivo1.length);  
console.log('- Propiedades únicas archivo 2:', solo_archivo2.length);
console.log('- Total propiedades únicas esperadas:', solo_archivo1.length + solo_archivo2.length + (ids1.size - solo_archivo1.length));

// Verificar nombres de archivos
console.log('\nNombres de archivos según seedUrl:');
console.log('Archivo 1 URL:', data1.seedUrl);
console.log('Archivo 2 URL:', data2.seedUrl);

// Fechas de scraping
console.log('\nFechas de scraping:');
console.log('Archivo 1:', data1.scrapedAt);
console.log('Archivo 2:', data2.scrapedAt);