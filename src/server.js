// server.js - Servidor Express con webhook para Ultramsg
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import { processMessage } from './messageProcessor.js';
import { sendWhatsAppMessage } from './ultramsgClient.js';
import { getSession, updateSession, addToConversationHistory, getSessionStats } from './userManager.js';
import { verifyConnections, initializeDatabase } from '../config/database.js';
import { getCollectionStats } from './qdrantSearch.js';
import { sendPropertyImage } from './imageHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'Rosario Properties Bot',
    timestamp: new Date().toISOString()
  });
});

// Webhook principal de Ultramsg
app.post('/webhook', async (req, res) => {
  try {
    console.log('📨 Webhook recibido:', JSON.stringify(req.body, null, 2));
    
    // Extraer datos del mensaje
    const data = req.body.data || req.body;
    const { 
      from, 
      body: messageBody, 
      id: messageId,
      fromMe,
      author,
      chatName,
      pushName,
      type
    } = data;
    
    // Ignorar mensajes propios
    if (fromMe) {
      return res.status(200).json({ status: 'ignored', reason: 'own message' });
    }
    
    // Solo procesar mensajes de texto
    if (type !== 'chat' && type !== 'text') {
      await sendWhatsAppMessage(from, '🤖 Por ahora solo puedo procesar mensajes de texto. Por favor, escribe tu consulta sobre propiedades.');
      return res.status(200).json({ status: 'ignored', reason: 'non-text message' });
    }
    
    // Validar que tengamos los datos necesarios
    if (!from || !messageBody) {
      console.error('❌ Mensaje sin datos necesarios');
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Log del mensaje recibido
    console.log(`\n💬 Nuevo mensaje de ${from}:`);
    console.log(`   Contenido: "${messageBody}"`);
    console.log(`   Chat: ${chatName || 'Privado'}`);
    console.log(`   ID: ${messageId}`);
    
    // Obtener o crear sesión del usuario (con pushName para nuevos usuarios)
    const session = await getSession(from, pushName);
    
    // Enviar indicador de "escribiendo"
    await sendWhatsAppMessage(from, '⌨️', { typing: true });
    
    // Procesar el mensaje
    const response = await processMessage(messageBody, session);
    
    // Agregar al historial de conversación
    addToConversationHistory(from, 'user', messageBody);
    addToConversationHistory(from, 'bot', response.text);
    
    // Actualizar sesión con el contexto
    await updateSession(from, {
      lastMessage: messageBody,
      lastResponse: response.text,
      context: response.context,
      lastActivity: new Date()
    });
    
    // Enviar respuesta
    await sendWhatsAppMessage(from, response.text);
    
    // Si necesita enviar imagen
    if (response.sendImage && response.property) {
      console.log(`📸 Enviando imagen de propiedad: ${response.property.title}`);
      try {
        await sendPropertyImage(from, response.property);
      } catch (imageError) {
        console.error('❌ Error enviando imagen:', imageError);
        await sendWhatsAppMessage(from, '❌ No pude enviar la foto de esta propiedad.');
      }
    }
    
    // Si hay propiedades, enviar también los detalles
    if (response.properties && response.properties.length > 0) {
      // Esperar un poco antes de enviar los detalles
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Enviar mensaje con opciones
      const optionsMessage = '\n📱 *Opciones:*\n' +
        '• Escribe el número de una propiedad para ver más detalles\n' +
        '• Escribe "más" para ver más resultados\n' +
        '• Puedes refinar tu búsqueda agregando más criterios';
      
      await sendWhatsAppMessage(from, optionsMessage);
    }
    
    // Responder al webhook
    res.status(200).json({ 
      status: 'success',
      messageId: messageId,
      processed: true
    });
    
  } catch (error) {
    console.error('❌ Error procesando webhook:', error);
    
    // Intentar enviar mensaje de error al usuario
    try {
      if (req.body.from) {
        await sendWhatsAppMessage(
          req.body.from, 
          '❌ Lo siento, ocurrió un error procesando tu mensaje. Por favor, intenta de nuevo en unos momentos.'
        );
      }
    } catch (sendError) {
      console.error('❌ Error enviando mensaje de error:', sendError);
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Endpoint para configurar el webhook en Ultramsg
app.get('/webhook/setup', async (req, res) => {
  const webhookUrl = `${process.env.WEBHOOK_URL || `http://localhost:${PORT}`}/webhook`;
  
  res.json({
    message: 'Configura este URL en tu panel de Ultramsg',
    webhookUrl: webhookUrl,
    instance: process.env.ULTRAMSG_INSTANCE_ID
  });
});

// Endpoint de prueba para enviar mensaje
app.post('/test/send', async (req, res) => {
  try {
    const { to, message } = req.body;
    
    if (!to || !message) {
      return res.status(400).json({ error: 'Missing "to" or "message" fields' });
    }
    
    const result = await sendWhatsAppMessage(to, message);
    res.json({ success: true, result });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para estadísticas
app.get('/stats', async (req, res) => {
  try {
    const sessionStats = getSessionStats();
    const collectionStats = await getCollectionStats();
    
    res.json({
      timestamp: new Date().toISOString(),
      sessions: sessionStats,
      database: collectionStats,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para health check detallado
app.get('/health', async (req, res) => {
  try {
    const connections = await verifyConnections();
    const isHealthy = connections.qdrant && connections.openai;
    
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      connections,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'unhealthy',
      error: error.message 
    });
  }
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('❌ Error no manejado:', err);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Inicializar y arrancar servidor
async function startServer() {
  console.log('🚀 Iniciando Bot de Propiedades Rosario...\n');
  
  // Verificar conexiones
  console.log('🔍 Verificando conexiones...');
  const connections = await verifyConnections();
  
  if (!connections.qdrant || !connections.openai) {
    console.error('❌ Error en conexiones requeridas:');
    connections.errors.forEach(error => console.error(`   ${error}`));
    process.exit(1);
  }
  
  // Inicializar base de datos Qdrant
  console.log('\n🗄️  Inicializando base de datos...');
  await initializeDatabase();
  
  // Iniciar servidor
  app.listen(PORT, () => {
    console.log('\n✅ Bot iniciado correctamente');
    console.log(`📡 Servidor escuchando en puerto ${PORT}`);
    console.log(`🔗 Webhook URL: http://localhost:${PORT}/webhook`);
    console.log(`📝 Para configurar webhook: http://localhost:${PORT}/webhook/setup`);
    console.log('\n⏳ Esperando mensajes de WhatsApp...\n');
  });
}

startServer().catch(console.error);