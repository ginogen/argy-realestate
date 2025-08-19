// ultramsgClient.js - Cliente para enviar mensajes con Ultramsg
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const INSTANCE_ID = process.env.ULTRAMSG_INSTANCE_ID;
const TOKEN = process.env.ULTRAMSG_TOKEN;

// Validar configuración
if (!INSTANCE_ID || !TOKEN) {
  console.error('❌ ULTRAMSG_INSTANCE_ID o ULTRAMSG_TOKEN no configurados');
}

const BASE_URL = `https://api.ultramsg.com/${INSTANCE_ID}`;

// Función para enviar mensaje de WhatsApp
export async function sendWhatsAppMessage(to, message, options = {}) {
  try {
    // Validar parámetros
    if (!to || !message) {
      throw new Error('Parámetros "to" y "message" son requeridos');
    }
    
    // Limpiar número (quitar caracteres especiales)
    const cleanNumber = String(to).replace(/[^0-9]/g, '');
    
    // Asegurar formato correcto (agregar código de país si falta)
    const formattedNumber = cleanNumber.startsWith('549') 
      ? cleanNumber 
      : `549${cleanNumber}`;
    
    // Si es solo indicador de escribiendo
    if (options.typing) {
      const typingUrl = `${BASE_URL}/chats/typing`;
      await axios.post(typingUrl, {
        token: TOKEN,
        to: `${formattedNumber}@c.us`,
        typing: 'composing'
      });
      return { success: true, action: 'typing' };
    }
    
    // Endpoint para enviar mensaje
    const sendUrl = `${BASE_URL}/messages/chat`;
    
    // Preparar payload
    const payload = {
      token: TOKEN,
      to: `${formattedNumber}@c.us`,
      body: message,
      priority: 10,
      referenceId: ''
    };
    
    console.log(`📤 Enviando mensaje a ${formattedNumber}...`);
    
    // Enviar mensaje
    const response = await axios.post(sendUrl, payload);
    
    if (response.data.sent) {
      console.log(`✅ Mensaje enviado exitosamente. ID: ${response.data.id}`);
      return {
        success: true,
        messageId: response.data.id,
        to: formattedNumber
      };
    } else {
      throw new Error(response.data.message || 'Error al enviar mensaje');
    }
    
  } catch (error) {
    console.error('❌ Error enviando mensaje WhatsApp:', error.response?.data || error.message);
    throw error;
  }
}

// Función para enviar imagen con caption
export async function sendWhatsAppImage(to, imageUrl, caption = '') {
  try {
    const cleanNumber = to.replace(/[^0-9]/g, '');
    const formattedNumber = cleanNumber.startsWith('549') 
      ? cleanNumber 
      : `549${cleanNumber}`;
    
    const sendUrl = `${BASE_URL}/messages/image`;
    
    const payload = {
      token: TOKEN,
      to: `${formattedNumber}@c.us`,
      image: imageUrl,
      caption: caption,
      priority: 10,
      referenceId: ''
    };
    
    console.log(`📤 Enviando imagen a ${formattedNumber}...`);
    
    const response = await axios.post(sendUrl, payload);
    
    if (response.data.sent) {
      console.log(`✅ Imagen enviada exitosamente. ID: ${response.data.id}`);
      return {
        success: true,
        messageId: response.data.id,
        to: formattedNumber
      };
    } else {
      throw new Error(response.data.message || 'Error al enviar imagen');
    }
    
  } catch (error) {
    console.error('❌ Error enviando imagen WhatsApp:', error.response?.data || error.message);
    throw error;
  }
}

// Función para enviar ubicación
export async function sendWhatsAppLocation(to, latitude, longitude, address = '') {
  try {
    const cleanNumber = to.replace(/[^0-9]/g, '');
    const formattedNumber = cleanNumber.startsWith('549') 
      ? cleanNumber 
      : `549${cleanNumber}`;
    
    const sendUrl = `${BASE_URL}/messages/location`;
    
    const payload = {
      token: TOKEN,
      to: `${formattedNumber}@c.us`,
      address: address,
      lat: latitude,
      lng: longitude
    };
    
    console.log(`📤 Enviando ubicación a ${formattedNumber}...`);
    
    const response = await axios.post(sendUrl, payload);
    
    if (response.data.sent) {
      console.log(`✅ Ubicación enviada exitosamente. ID: ${response.data.id}`);
      return {
        success: true,
        messageId: response.data.id,
        to: formattedNumber
      };
    } else {
      throw new Error(response.data.message || 'Error al enviar ubicación');
    }
    
  } catch (error) {
    console.error('❌ Error enviando ubicación WhatsApp:', error.response?.data || error.message);
    throw error;
  }
}

// Función para enviar mensaje con botones (si Ultramsg lo soporta)
export async function sendWhatsAppButtons(to, message, buttons) {
  try {
    const cleanNumber = to.replace(/[^0-9]/g, '');
    const formattedNumber = cleanNumber.startsWith('549') 
      ? cleanNumber 
      : `549${cleanNumber}`;
    
    // Nota: Verificar si Ultramsg soporta botones interactivos
    // Si no, enviar como mensaje normal con opciones numeradas
    
    let formattedMessage = message + '\n\n';
    buttons.forEach((button, index) => {
      formattedMessage += `${index + 1}. ${button.text}\n`;
    });
    
    return await sendWhatsAppMessage(to, formattedMessage);
    
  } catch (error) {
    console.error('❌ Error enviando botones WhatsApp:', error);
    throw error;
  }
}

// Función para obtener información del webhook
export async function getWebhookInfo() {
  try {
    const url = `${BASE_URL}/instance/settings`;
    const response = await axios.get(url, {
      params: { token: TOKEN }
    });
    
    return response.data;
  } catch (error) {
    console.error('❌ Error obteniendo info del webhook:', error.response?.data || error.message);
    throw error;
  }
}

// Función para configurar webhook
export async function setWebhook(webhookUrl) {
  try {
    const url = `${BASE_URL}/instance/settings`;
    const payload = {
      token: TOKEN,
      webhookUrl: webhookUrl,
      sendWebhook: 'true',
      webhookChatMessage: 'true',
      webhookMessageStatus: 'true'
    };
    
    const response = await axios.post(url, payload);
    
    if (response.data.success) {
      console.log('✅ Webhook configurado exitosamente');
      return response.data;
    } else {
      throw new Error(response.data.message || 'Error configurando webhook');
    }
    
  } catch (error) {
    console.error('❌ Error configurando webhook:', error.response?.data || error.message);
    throw error;
  }
}