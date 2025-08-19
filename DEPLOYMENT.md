# Deployment en Render - Bot de Propiedades

## 🚀 Pasos para desplegar

### 1. Preparar repositorio Git

```bash
# En la carpeta bot/
git init
git add .
git commit -m "Initial commit: WhatsApp properties bot"

# Subir a GitHub
# Crear repo en GitHub: rosario-properties-bot
git remote add origin https://github.com/tu-usuario/rosario-properties-bot.git
git branch -M main
git push -u origin main
```

### 2. Configurar Render

1. **Ir a [Render.com](https://render.com)**
2. **Conectar con GitHub**
3. **New → Web Service**
4. **Conectar tu repositorio**: `rosario-properties-bot`

### 3. Configuración del servicio

**Configuración básica:**
- **Name**: `rosario-properties-bot`
- **Region**: `Oregon (US West)`
- **Branch**: `main`
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`

**Plan:**
- **Free** (suficiente para empezar)

### 4. Variables de entorno

En Render → Environment → Add Environment Variable:

```env
NODE_ENV=production
PORT=10000

# OpenAI
OPENAI_API_KEY=sk-proj-tu-clave-aqui

# Qdrant Cloud (recomendado para producción)
QDRANT_URL=https://tu-cluster.qdrant.tech:6333
QDRANT_API_KEY=tu-api-key-qdrant

# Ultramsg
ULTRAMSG_INSTANCE_ID=instance_xxxxx
ULTRAMSG_TOKEN=tu-token-ultramsg

# Webhook (se configura después del deploy)
WEBHOOK_URL=https://tu-app.onrender.com/webhook

# Configuración del bot
MAX_RESULTS_PER_QUERY=10
SESSION_TIMEOUT_MINUTES=30
```

### 5. **Deploy inicial**
- Click **Create Web Service**
- Esperar ~5-10 minutos para el primer deploy
- Render te dará una URL como: `https://rosario-properties-bot-xxxx.onrender.com`

### 6. **Configurar Qdrant Cloud (Recomendado)**

#### Opción A: Qdrant Cloud
1. Ir a [cloud.qdrant.io](https://cloud.qdrant.io)
2. Crear cuenta gratuita
3. Crear cluster (Free tier: 1GB)
4. Obtener URL y API Key
5. Configurar en variables de entorno de Render

#### Opción B: Qdrant local (no recomendado para producción)
Si usas Qdrant local, necesitarás un túnel como ngrok.

### 7. **Cargar datos en producción**

Una vez desplegado, cargar propiedades:

```bash
# Opción 1: Desde tu local conectando a Qdrant Cloud
export QDRANT_URL=https://tu-cluster.qdrant.tech:6333
export QDRANT_API_KEY=tu-api-key
export OPENAI_API_KEY=sk-proj-tu-clave
npm run load-final

# Opción 2: Usar Render Shell (si está disponible)
# En Render → Shell
npm run load-final
```

### 8. **Configurar webhook en Ultramsg**

1. **URL del webhook**: `https://tu-app.onrender.com/webhook`
2. **En Ultramsg panel**:
   - Settings → Webhooks
   - Webhook URL: `https://tu-app.onrender.com/webhook`
   - Send Webhook: ✅
   - Chat Message: ✅
   - Message Status: ✅

### 9. **Verificar deployment**

```bash
# Health check
curl https://tu-app.onrender.com/health

# Configuración webhook
curl https://tu-app.onrender.com/webhook/setup

# Estadísticas
curl https://tu-app.onrender.com/stats
```

### 10. **Enviar mensaje de prueba**

```bash
curl -X POST https://tu-app.onrender.com/test/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "5493416123456",
    "message": "¡Hola! Soy tu bot de propiedades en Rosario"
  }'
```

## 🔧 Configuraciones adicionales

### Dominio personalizado (opcional)
- En Render → Settings → Custom Domains
- Agregar tu dominio
- Actualizar WEBHOOK_URL

### Logs y monitoreo
- Render → Logs (para ver logs en tiempo real)
- Render → Metrics (para uso de recursos)

### Escalabilidad
- Free plan: 512MB RAM, se duerme después de 15 min sin uso
- Starter plan ($7/mes): Sin sleep, más recursos

## 📱 URLs importantes

Después del deploy tendrás:
- **App**: `https://tu-app.onrender.com`
- **Webhook**: `https://tu-app.onrender.com/webhook`
- **Health**: `https://tu-app.onrender.com/health`
- **Stats**: `https://tu-app.onrender.com/stats`
- **Setup**: `https://tu-app.onrender.com/webhook/setup`

## 🐛 Troubleshooting

### Bot no responde
1. Verificar logs en Render
2. Verificar variables de entorno
3. Probar health check
4. Verificar webhook en Ultramsg

### Errores de Qdrant
1. Verificar URL y API Key
2. Confirmar que datos estén cargados
3. Revisar logs de conexión

### Errores de OpenAI
1. Verificar API Key
2. Confirmar créditos disponibles
3. Revisar rate limits

## 🔐 Seguridad

- Nunca commitear archivos .env
- Usar variables de entorno en Render
- API Keys solo en panel de Render
- HTTPS obligatorio para webhooks

## 📊 Monitoreo

Endpoints para monitoreo:
- `GET /health` - Estado general
- `GET /stats` - Estadísticas de uso
- Logs en Render dashboard

## 🚀 CI/CD

Render hace auto-deploy cuando:
- Haces push a main branch
- Cambias variables de entorno
- Actualizas configuración

## 💰 Costos estimados

**Free plan** (para empezar):
- Render: $0 (con limitaciones)
- Qdrant Cloud: $0 (1GB)
- OpenAI: ~$5-10/mes (uso moderado)
- Ultramsg: Según plan elegido

**Producción recomendada**:
- Render Starter: $7/mes
- Qdrant Cloud: $0-20/mes
- OpenAI: ~$10-20/mes
- Total: ~$17-47/mes