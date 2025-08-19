# Configuración de Ultramsg para el Bot de Propiedades

## 1. 🔐 **Crear cuenta en Ultramsg**

1. Ve a [Ultramsg.com](https://ultramsg.com)
2. Regístrate y crea una cuenta
3. Verifica tu email

## 2. 📱 **Conectar WhatsApp**

1. En el dashboard, click "Create Instance"
2. Escanea el código QR con tu WhatsApp
3. Espera a que aparezca "Connected" ✅
4. **IMPORTANTE**: No cierres WhatsApp Web en otros dispositivos

## 3. 🔧 **Obtener credenciales**

Una vez conectado, anota:
- **Instance ID**: `instance_xxxxx` (aparece en la URL)
- **Token**: En Settings → API Token

## 4. ⚙️ **Configurar webhook**

### Opción A: Configuración automática (recomendada)

1. Inicia tu bot: `npm start`
2. Ve a: `http://localhost:3000/webhook/setup`
3. Copia la URL que aparece
4. En Ultramsg → Settings → Webhooks:
   - **Webhook URL**: Pega la URL copiada
   - **Send Webhook**: ✅ Activado
   - **Chat Message**: ✅ Activado
   - **Message Status**: ✅ Activado (opcional)

### Opción B: Configuración manual

En tu panel de Ultramsg:
1. Ve a Settings → Webhooks
2. Configura:
   ```
   Webhook URL: https://tu-dominio.com/webhook
   Send Webhook: ✅
   Chat Message: ✅
   Message Status: ✅
   ```

## 5. 🌐 **Exponer tu bot al internet**

### Para desarrollo (ngrok):
```bash
# Instalar ngrok
npm install -g ngrok

# Exponer puerto 3000
ngrok http 3000

# Usar la URL HTTPS que te da ngrok
# Ejemplo: https://abc123.ngrok.io/webhook
```

### Para producción:
- Usar un servicio como Railway, Heroku, o VPS
- Asegurar que sea HTTPS

## 6. 📋 **Variables de entorno**

En tu archivo `.env`:
```env
# Ultramsg
ULTRAMSG_INSTANCE_ID=instance_12345
ULTRAMSG_TOKEN=tu_token_aqui

# Webhook (para producción)
WEBHOOK_URL=https://tu-dominio.com/webhook
```

## 7. ✅ **Verificar configuración**

### Método 1: Endpoint de prueba
```bash
curl -X POST http://localhost:3000/test/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "5493416123456", 
    "message": "¡Hola! Soy tu bot de propiedades"
  }'
```

### Método 2: Mensaje directo
Envía un mensaje a tu número de WhatsApp conectado con:
```
hola
```

Si responde, ¡está funcionando! 🎉

## 8. 🔍 **Troubleshooting**

### "Webhook not receiving messages"
1. Verifica que la URL sea HTTPS
2. Revisa los logs del bot: `npm run dev`
3. Confirma que el webhook esté configurado correctamente

### "Message not sending"
1. Verifica Instance ID y Token
2. Confirma que WhatsApp esté conectado
3. Revisa los logs de errores

### "Bot not responding"
1. Verifica que Qdrant esté corriendo
2. Confirma OpenAI API Key
3. Revisa que las propiedades estén cargadas

## 9. 📊 **Monitoreo**

Endpoints útiles:
- **Estado**: `GET /health`
- **Estadísticas**: `GET /stats`
- **Configuración webhook**: `GET /webhook/setup`

## 10. 🚀 **Para producción**

1. **Railway/Heroku**:
   ```bash
   # Railway
   railway deploy
   
   # Heroku
   git push heroku main
   ```

2. **Actualizar webhook** con la nueva URL de producción

3. **Configurar variables de entorno** en la plataforma

## 🔐 **Seguridad**

- ⚠️ **Nunca compartas** tu Token de Ultramsg
- 🔒 **Usa HTTPS** siempre para webhooks
- 📱 **No desconectes** WhatsApp Web del dispositivo original

## 📞 **Soporte**

Si tienes problemas:
1. Revisa logs del bot: `npm run dev`
2. Verifica configuración: `npm run setup`
3. Consulta documentación de Ultramsg: [docs.ultramsg.com](https://docs.ultramsg.com)