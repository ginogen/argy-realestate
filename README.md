# Bot de WhatsApp para Propiedades en Rosario

Bot inteligente de WhatsApp que permite consultar propiedades en alquiler en Rosario usando búsqueda semántica con Qdrant y procesamiento de lenguaje natural con GPT-4.

## 🚀 Características

- 🔍 **Búsqueda semántica inteligente** con Qdrant
- 🤖 **Procesamiento de lenguaje natural** con GPT-4
- 💬 **Interfaz conversacional** en WhatsApp
- 🎯 **Filtros precisos** por precio, zona, dormitorios, etc.
- 📱 **Respuestas optimizadas** para WhatsApp
- 🧠 **Memoria de conversación** y aprendizaje de preferencias
- ⚡ **Búsquedas paralelas** y resultados rápidos

## 📁 Estructura del Proyecto

```
bot/
├── src/
│   ├── server.js              # Servidor Express principal
│   ├── messageProcessor.js    # Procesador de mensajes con IA
│   ├── qdrantSearch.js        # Motor de búsqueda en Qdrant
│   ├── responseFormatter.js   # Formateador para WhatsApp
│   ├── ultramsgClient.js     # Cliente de Ultramsg
│   └── sessionManager.js     # Manejo de sesiones
├── scripts/
│   └── loadToQdrant.js       # Script para cargar datos
├── config/
└── data/
```

## 🛠️ Instalación

### 1. Clonar e instalar dependencias

```bash
cd bot
npm install
```

### 2. Configurar variables de entorno

Copia `.env.example` a `.env` y configura:

```bash
cp .env.example .env
```

Edita `.env` con tus credenciales:

```env
# OpenAI
OPENAI_API_KEY=sk-...

# Qdrant (local o cloud)
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=optional_if_cloud

# Ultramsg
ULTRAMSG_INSTANCE_ID=instance_xxxxx
ULTRAMSG_TOKEN=your_token

# Server
PORT=3000
WEBHOOK_URL=https://tu-dominio.com/webhook
```

### 3. Configurar Qdrant

#### Opción A: Qdrant Local (Docker)
```bash
docker run -p 6333:6333 qdrant/qdrant
```

#### Opción B: Qdrant Cloud
Regístrate en [Qdrant Cloud](https://cloud.qdrant.io) y obtén tu URL y API key.

### 4. Cargar datos de propiedades

```bash
npm run load-data
```

Esto procesará el archivo de propiedades y cargará ~3,000 propiedades en Qdrant con embeddings.

### 5. Iniciar el bot

```bash
# Desarrollo
npm run dev

# Producción
npm start
```

## 🔧 Configuración de Ultramsg

1. Ve a tu panel de Ultramsg
2. Configura el webhook URL: `https://tu-dominio.com/webhook`
3. Activa los siguientes eventos:
   - Chat messages
   - Message status (opcional)

## 💬 Uso del Bot

### Ejemplos de consultas:

```
Usuario: "Hola"
Bot: ¡Hola! 👋 Soy tu asistente de propiedades...

Usuario: "Busco depto 2 dormitorios en Centro hasta 400 mil"
Bot: 🔍 Encontré 8 propiedades que coinciden...

Usuario: "3"
Bot: 🏢 Departamento 2 dorm. - Centro
     📍 San Lorenzo 1234...

Usuario: "Algo con balcón zona norte"
Bot: 🔍 Encontré 12 propiedades que coinciden...
```

### Comandos disponibles:
- **Búsqueda natural**: "depto 2 dormitorios centro"
- **Ver detalles**: Escribir número (1-10)
- **Más resultados**: "más" o "siguiente"
- **Ayuda**: "ayuda"

## 🔍 Capacidades de Búsqueda

### Filtros soportados:
- **Precio**: "hasta 400 mil", "entre 200 y 500 mil"
- **Dormitorios**: "2 dormitorios", "mínimo 3 habitaciones"
- **Tipo**: "departamento", "casa", "PH"
- **Zona**: "centro", "zona norte", "fisherton"
- **Características**: "con balcón", "con cochera", "con jardín"

### Búsqueda semántica:
- "algo cómodo para familia"
- "departamento luminoso con vista"
- "casa tranquila zona residencial"
- "propiedad moderna cerca del centro"

## 🗄️ Arquitectura de Datos

### Qdrant Collection Schema:
```javascript
{
  id: "property_id",
  vector: [1536 dimensions], // OpenAI embedding
  payload: {
    title: "string",
    price: "number",
    bedrooms: "number",
    neighborhood: "string",
    propertyType: "string",
    // ... más campos
  }
}
```

### Índices para filtros rápidos:
- price, bedrooms, bathrooms
- neighborhood, propertyType
- hasBalcony, hasTerrace, hasGarden

## 🚀 Deployment

### Opción 1: Railway
```bash
# Conectar a Railway
railway link
railway deploy
```

### Opción 2: Vercel
```bash
vercel deploy
```

### Opción 3: VPS
```bash
# Usar PM2 para producción
npm install -g pm2
pm2 start src/server.js --name "properties-bot"
```

## 📊 Monitoreo

### Estadísticas de sesiones:
```bash
curl http://localhost:3000/stats
```

### Logs del bot:
```bash
# Ver logs en tiempo real
tail -f logs/bot.log

# Con PM2
pm2 logs properties-bot
```

## 🔧 Desarrollo

### Scripts disponibles:
```bash
npm run dev          # Desarrollo con nodemon
npm run start        # Producción
npm run load-data    # Cargar propiedades en Qdrant
```

### Testing:
```bash
# Enviar mensaje de prueba
curl -X POST http://localhost:3000/test/send \
  -H "Content-Type: application/json" \
  -d '{"to": "5493416123456", "message": "Test"}'
```

## 🛡️ Seguridad

- Validación de entrada de usuarios
- Rate limiting en endpoints
- Sanitización de respuestas
- Logs de seguridad

## 📈 Optimizaciones

- Cache de embeddings frecuentes
- Índices optimizados en Qdrant
- Compresión de respuestas
- Lazy loading de datos

## 🐛 Troubleshooting

### Error común: "Qdrant connection failed"
```bash
# Verificar que Qdrant esté corriendo
curl http://localhost:6333/collections
```

### Error: "OpenAI API rate limit"
- Verificar límites de tu cuenta OpenAI
- Implementar retry con backoff

### Error: "Ultramsg webhook not working"
- Verificar URL webhook sea HTTPS
- Revisar logs del servidor

## 📞 Soporte

Para issues y mejoras, crear un issue en el repositorio.

## 📄 Licencia

MIT License