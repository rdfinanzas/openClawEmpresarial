# Configuración Inicial - OpenClaw Transformation

Esta guía explica cómo configurar OpenClaw para el modo de transformación multi-rol con superadmin exclusivo en Telegram.

## Requisitos Previos

- OpenClaw instalado y funcionando
- Bot de Telegram configurado (token de bot)
- Acceso a tu cuenta de Telegram

## Paso 1: Obtener tu Telegram User ID

El **Telegram User ID** es un número único que identifica tu cuenta de Telegram. Necesitas este ID para configurar el acceso de superadmin.

### Método 1: Usando @userinfobot (Recomendado)

1. Abre Telegram
2. Busca el bot `@userinfobot`
3. Inicia una conversación con `/start`
4. El bot te responderá con tu información, incluyendo tu **User ID**
5. Copia el número que aparece como "Id" (ejemplo: `123456789`)

### Método 2: Usando @getidsbot

1. Abre Telegram
2. Busca el bot `@getidsbot`
3. Envía cualquier mensaje
4. El bot responderá con tu User ID

### Método 3: Desde los logs de OpenClaw

Si ya tienes OpenClaw corriendo con Telegram:

1. Envía un mensaje a tu bot de OpenClaw
2. Revisa los logs del gateway
3. Busca líneas que contengan `from` o `userId`
4. Tu User ID aparecerá en el formato numérico

## Paso 2: Configurar el Superadmin

Edita tu archivo de configuración `~/.openclaw/openclaw.json` (o `%USERPROFILE%\.openclaw\openclaw.json` en Windows):

```json
{
  "gateway": {
    "superadmin": {
      "telegramUserId": 123456789,
      "activationKeyword": "ACTIVAR_BOT",
      "enabled": true
    }
  }
}
```

### Parámetros de Configuración

- **`telegramUserId`** (obligatorio): Tu Telegram User ID obtenido en el Paso 1
- **`activationKeyword`** (opcional): Palabra clave para activar el bot. Por defecto no se requiere.
- **`enabled`** (opcional): Habilita/deshabilita el modo superadmin. Por defecto: `true`

## Paso 3: Configurar el Token de Telegram

Asegúrate de tener configurado el token de tu bot de Telegram:

### Opción A: Variable de Entorno (Recomendado)

Crea o edita el archivo `.env` en la raíz del proyecto:

```env
TELEGRAM_BOT_TOKEN=123456:ABCDEF...
```

### Opción B: En el archivo de configuración

```json
{
  "telegram": {
    "token": "123456:ABCDEF..."
  }
}
```

> **⚠️ Advertencia de Seguridad**: Nunca compartas tu token de bot. Mantenlo en secreto.

## Paso 4: Reiniciar OpenClaw

Después de realizar los cambios de configuración:

```bash
# Detener OpenClaw si está corriendo
# Ctrl+C o el método que uses

# Iniciar OpenClaw
openclaw
```

## Paso 5: Activar el Bot (si usas activationKeyword)

Si configuraste una `activationKeyword`:

1. Abre Telegram
2. Envía un mensaje a tu bot que contenga la palabra clave (ejemplo: `ACTIVAR_BOT`)
3. El bot confirmará la activación
4. Ahora puedes usar el bot normalmente

Si **no** configuraste `activationKeyword`, el bot estará activo automáticamente para tu User ID.

## Verificación

Para verificar que la configuración funciona:

1. Envía un mensaje a tu bot de Telegram
2. El bot debe responder normalmente
3. Intenta que otra persona envíe un mensaje a tu bot
4. Esa persona **no** debe recibir respuesta (el bot ignorará el mensaje)

## Solución de Problemas

### El bot no responde a mis mensajes

- **Verifica tu User ID**: Asegúrate de que el `telegramUserId` en la configuración coincida exactamente con tu ID real
- **Revisa la palabra clave**: Si configuraste `activationKeyword`, asegúrate de haberla enviado primero
- **Revisa los logs**: Busca errores en la salida de OpenClaw

### El bot responde a otros usuarios

- **Verifica la configuración**: Asegúrate de que la sección `gateway.superadmin` esté correctamente configurada
- **Reinicia OpenClaw**: Los cambios de configuración requieren reiniciar el servicio

### No puedo encontrar mi User ID

- Usa `@userinfobot` como se describe en el Paso 1
- Asegúrate de estar usando tu cuenta personal de Telegram, no una cuenta de bot

## Configuración Avanzada

### Múltiples Palabras Clave

Actualmente solo se soporta una palabra clave de activación. Si necesitas cambiarla:

1. Edita `activationKeyword` en la configuración
2. Reinicia OpenClaw
3. Envía la nueva palabra clave

### Desactivar Temporalmente el Modo Superadmin

```json
{
  "gateway": {
    "superadmin": {
      "telegramUserId": 123456789,
      "enabled": false
    }
  }
}
```

Esto permitirá que el bot funcione en modo normal (sin restricciones de superadmin).

## Próximos Pasos

Una vez configurado el superadmin:

1. Configura los canales públicos (WhatsApp, Discord, etc.)
2. Define las herramientas permitidas para usuarios públicos
3. Configura el panel web de administración
4. Establece las APIs empresariales

Consulta la documentación completa en `PLAN_TRANSFORMACION_OPENCLAW.md` para más detalles.

## Soporte

Si encuentras problemas:

1. Revisa los logs de OpenClaw
2. Verifica que tu configuración JSON sea válida
3. Consulta la documentación de seguridad en `SECURITY.md`
