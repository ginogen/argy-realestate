(async () => {
// 1) Pega acá el payload EXACTO que copiaste de Network (ajustalo si querés):
const basePayload = {
// 👇 EJEMPLO — reemplazá esto por el payload que viste
q: null, direccion: null, moneda: "", preciomin: null, preciomax: null,
services: "", general: "", searchbykeyword: "", amenidades: "",
caracteristicasprop: null, comodidades: "", disposicion: null, roomType: "",
outside: "", areaPrivativa: "", areaComun: "", multipleRets: "",
tipoDePropiedad: null, subtipoDePropiedad: null, tipoDeOperacion: "2",
garages: null, antiguedad: null, expensasminimo: null, expensasmaximo: null,
withoutguarantor: null, habitacionesminimo: null, habitacionesmaximo: null,
ambientesminimo: 0, ambientesmaximo: 0, banos: null, superficieCubierta: 1,
idunidaddemedida: 1, metroscuadradomin: null, metroscuadradomax: null,
tipoAnunciante: "ALL", grupoTipoDeMultimedia: "", publicacion: null,
sort: "relevance", etapaDeDesarrollo: "", auctions: null, polygonApplied: null,
idInmobiliaria: null, excludePostingContacted: "", banks: "", places: "",
condominio: "", preTipoDeOperacion: "", pagina: 1,
city: "1004728", province: null, zone: null, valueZone: null, subZone: null, coordenates: null
};

// 2) Parámetros de control
const ENDPOINT = "/rplis-api/postings?dynamicListingSearch=true";
const SLEEP_MS = 250; // pausa entre páginas (bajalo/subilo si hace falta)
const RETRIES = 3; // reintentos por página
const PAGES_PER_FILE = 200; // cuántas páginas mete por archivo (evitar JSON gigantes)
const MAX_PAGES = 0; // 0 = todas las páginas disponibles

// Helpers
const sleep = ms => new Promise(r => setTimeout(r, ms));
const downloadJSON = (obj, name) => {
const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
const a = document.createElement("a");
a.href = URL.createObjectURL(blob);
a.download = name;
document.body.appendChild(a);
a.click();
URL.revokeObjectURL(a.href);
a.remove();
};

async function fetchPage(pagina) {
const payload = { ...basePayload, pagina };
for (let i = 1; i <= RETRIES; i++) {
try {
const res = await fetch(ENDPOINT, {
method: "POST",
credentials: "include",
headers: {
"accept": "application/json, text/plain, _/_",
"content-type": "application/json",
"x-requested-with": "XMLHttpRequest"
},
body: JSON.stringify(payload),
redirect: "follow",
cache: "no-store"
});
if (!res.ok) throw new Error(`HTTP ${res.status}`);
return await res.json();
} catch (e) {
console.warn(`p${pagina} intento ${i}/${RETRIES}: ${e}`);
await sleep(400 \* i); // backoff suave
}
}
throw new Error(`Fallo definitivo en página ${pagina}`);
}

// 3) Primera página para ver paginación real
console.log("➡️ Descargando página 1…");
const first = await fetchPage(1);
const paging = first?.paging || {};
const totalPagesReal = paging?.totalPages || Math.max(1, Math.ceil((paging.total || 0) / (paging.limit || 30)));
const totalPages = (MAX_PAGES && MAX_PAGES > 0) ? Math.min(MAX_PAGES, totalPagesReal) : totalPagesReal;
console.log(`📄 totalPages=${totalPages} (total=${paging.total}, limit=${paging.limit})`);

// 4) Acumular y descargar por tandas
let batchItems = [...(first.listPostings || [])];
let batchStart = 1;

for (let p = 2; p <= totalPages; p++) {
await sleep(SLEEP_MS);
console.log(`➡️ Página ${p}/${totalPages}`);
const j = await fetchPage(p);
batchItems.push(...(j.listPostings || []));

    // dump por archivo cada PAGES_PER_FILE o al final
    const isBatchEnd = ((p - batchStart + 1) % PAGES_PER_FILE === 0) || p === totalPages;
    if (isBatchEnd) {
      const fileIdx = Math.ceil(p / PAGES_PER_FILE);
      const out = {
        scrapedAt: new Date().toISOString(),
        seedUrl: location.href,
        pagingMeta: { total: paging.total, limit: paging.limit, totalPages: totalPagesReal },
        pageRange: [batchStart, p],
        count: batchItems.length,
        listPostings: batchItems
      };
      const fname = `postings_${document.title.replace(/\W+/g,'_').slice(0,60)}__p${batchStart}-${p}.json`;
      downloadJSON(out, fname);
      console.log(`✅ Archivo descargado: ${fname} (${batchItems.length} avisos)`);

      // reset batch
      batchStart = p + 1;
      batchItems = [];
    }

}

// Edge case: si solo había 1 página, descargar ahora
if (totalPages === 1) {
const out = {
scrapedAt: new Date().toISOString(),
seedUrl: location.href,
pagingMeta: { total: paging.total, limit: paging.limit, totalPages: totalPagesReal },
pageRange: [1, 1],
count: batchItems.length,
listPostings: batchItems
};
const fname = `postings_${document.title.replace(/\W+/g,'_').slice(0,60)}__p1-1.json`;
downloadJSON(out, fname);
console.log(`✅ Archivo descargado: ${fname} (${batchItems.length} avisos)`);
}

console.log("🏁 Listo.");
})();
