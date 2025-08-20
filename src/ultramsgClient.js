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

// Función para notificar nuevo usuario al admin
export async function notifyNewUser(userNumber, pushName = null, totalUsers = null) {
  try {
    const adminNumber = process.env.ADMIN_PHONE_NUMBER;
    
    if (!adminNumber) {
      console.log('⚠️ ADMIN_PHONE_NUMBER no configurado, saltando notificación');
      return;
    }
    
    // Formatear número del usuario para mostrar
    const cleanUserNumber = userNumber.replace(/[^0-9]/g, '');
    const formattedUserNumber = cleanUserNumber.replace(/^549?(.{2})(.{4})(.{4})$/, '+54 $1 $2-$3');
    
    // Formatear fecha actual
    const now = new Date();
    const formattedDate = now.toLocaleDateString('es-AR', {
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    // Crear mensaje de notificación
    let message = `🆕 NUEVO USUARIO REGISTRADO\n\n`;
    message += `👤 Número: ${formattedUserNumber}\n`;
    message += `📱 Nombre: ${pushName || 'Sin nombre'}\n`;
    message += `📅 Fecha: ${formattedDate}\n`;
    
    if (totalUsers) {
      message += `🔢 Total usuarios: ${totalUsers}`;
    }
    
    // Enviar notificación al admin
    const result = await sendWhatsAppMessage(adminNumber, message);
    
    if (result.success) {
      console.log(`✅ Notificación de nuevo usuario enviada al admin: ${adminNumber}`);
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Error enviando notificación de nuevo usuario:', error.message);
    // No lanzar error para que no interrumpa el registro del usuario
    return { success: false, error: error.message };
  }
}