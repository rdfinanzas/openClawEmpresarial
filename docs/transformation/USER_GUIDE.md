# Guía de Usuario - OpenClaw Bot de Atención al Público

> Versión 1.0 | Última actualización: 2026-02-12

## 📋 Tabla de Contenidos

1. [Introducción](#introducción)
2. [Primeros Pasos](#primeros-pasos)
3. [Guía para Usuarios Públicos](#guía-para-usuarios-públicos)
4. [Guía para Administradores](#guía-para-administradores)
5. [Preguntas Frecuentes (FAQ)](#preguntas-frecuentes-faq)
6. [Solución de Problemas](#solución-de-problemas)

---

## Introducción

OpenClaw es un bot de atención al público multi-canal que permite:

- **Atención automatizada** vía WhatsApp, Discord, Slack y más
- **Panel de administración web** para configuración y monitoreo
- **Integración con APIs empresariales** (stock, pedidos, citas)
- **Control de acceso** con roles (superadmin y público)

### Canales Soportados

| Canal | Rol | Estado |
|-------|-----|--------|
| Telegram | Superadmin | ✅ Activo |
| WhatsApp | Público | ✅ Activo |
| Discord | Público | ✅ Activo |
| Slack | Público | ✅ Activo |
| Signal | Público | ✅ Activo |

---

## Primeros Pasos

### Requisitos

- Node.js 22+
- Cuenta de Telegram (para administrador)
- Token de bot de Telegram
- (Opcional) Cuentas para otros canales

### Instalación Rápida

```bash
# Instalar OpenClaw
npm install -g openclaw@latest

# Configurar
openclaw config set superadmin.telegramUserId=123456789
openclaw config set channels.telegram.enabled=true

# Iniciar
openclaw gateway run
```

---

## Guía para Usuarios Públicos

### ¿Cómo interactuar con el bot?

#### WhatsApp

1. Agrega el número del bot a tus contactos
2. Envía un mensaje de saludo
3. El bot responderá con las opciones disponibles

**Ejemplos de mensajes:**
- "Hola" - Saludo inicial
- "¿Tienen stock de producto X?" - Consulta de inventario
- "Quiero hacer un pedido" - Crear pedido
- "¿Cuál es el horario de atención?" - Información general

#### Discord

1. Únete al servidor donde está el bot
2. Menciona al bot con `@OpenClaw`
3. Escribe tu consulta

**Ejemplos:**
```
@OpenClaw ¿Tienen disponible el producto X?
@OpenClaw Quiero agendar una cita para mañana
```

#### Slack

1. Abre un DM con el bot o úsalo en un canal
2. Menciona al bot si es en canal
3. Escribe tu consulta

### Limitaciones de Uso

Como usuario público, tienes acceso a:

✅ **Tools permitidas:**
- `search` - Búsqueda de información
- `enterprise_*` - APIs empresariales configuradas
- `calendar_view` - Ver disponibilidad de citas

❌ **Tools prohibidas:**
- `bash` / `exec` - Ejecución de comandos
- `file_delete` - Eliminar archivos
- `file_write` - Modificar archivos
- `browser` - Navegador web

### Consultas Comunes

#### Consultar Stock
```
Usuario: ¿Tienen disponible el producto ABC123?
Bot: 📦 Stock disponible: 15 unidades
     Precio: $99.99
     Ubicación: Depósito Central
```

#### Crear Pedido
```
Usuario: Quiero ordenar 2 unidades del producto ABC123
Bot: 🛒 Pedido recibido
     Producto: ABC123 (2 unidades)
     Total: $199.98
     
     ⚠️ El administrador debe aprobar este pedido.
     Te notificaremos cuando sea confirmado.
```

#### Agendar Cita
```
Usuario: Quiero agendar una cita para mañana a las 3pm
Bot: 📅 Disponibilidad confirmada
     Fecha: Mañana 14:00 - 15:00
     
     ¿Confirmas esta cita?
```

---

## Guía para Administradores

### Panel de Administración

Accede al panel en: `http://localhost:18789/admin`

#### Login

1. Ingresa tu username y password
2. Recibirás un código de verificación por Telegram
3. Ingresa el código para completar el login

#### Dashboard

El panel muestra:

- **Métricas de uso**: Mensajes, usuarios activos, tokens consumidos
- **Estado de canales**: Conectividad de cada canal
- **Actividad reciente**: Últimas interacciones

#### Gestión de APIs

Para agregar una API empresarial:

1. Ve a "API Management"
2. Click en "Add API"
3. Completa:
   - **Name**: Nombre identificador
   - **Description**: Descripción de la API
   - **Base URL**: URL base (ej: `https://api.tienda.com`)
   - **Auth Type**: Tipo de autenticación
4. Guarda y la API estará disponible para los usuarios

### Operaciones que Requieren Autorización Root

Las siguientes operaciones enviarán una solicitud de aprobación a tu Telegram:

| Operación | Descripción |
|-----------|-------------|
| `file_delete` | Eliminar archivos del sistema |
| `file_write` | Modificar archivos del sistema |
| `config_modify` | Cambiar configuración del bot |
| `system_restart` | Reiniciar el gateway |
| `user_delete` | Eliminar sesiones de usuarios |

**Cómo aprobar:**
1. Recibirás un mensaje en Telegram con los detalles
2. Usa los botones "✅ Aprobar" o "❌ Rechazar"
3. La operación se ejecutará automáticamente

### Configuración de Canales

#### Telegram (Superadmin)

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "accounts": [{
        "botToken": "${TELEGRAM_BOT_TOKEN}",
        "default": true
      }]
    }
  },
  "superadmin": {
    "telegramUserId": 123456789,
    "enabled": true
  }
}
```

#### WhatsApp (Público)

```json
{
  "channels": {
    "whatsapp": {
      "enabled": true,
      "accounts": [{
        "accountId": "default"
      }]
    }
  }
}
```

---

## Preguntas Frecuentes (FAQ)

### General

**Q: ¿Puedo usar el bot en múltiples canales simultáneamente?**
R: Sí, el bot puede operar en Telegram, WhatsApp, Discord, Slack y Signal al mismo tiempo.

**Q: ¿Los usuarios públicos pueden ver mis archivos personales?**
R: No, los usuarios públicos solo tienen acceso a tools de solo lectura y APIs empresariales configuradas.

**Q: ¿Cómo sé si una operación requiere mi aprobación?**
R: Recibirás un mensaje en Telegram con los detalles y botones para aprobar/rechazar.

### Técnico

**Q: ¿Dónde se almacenan las credenciales?**
R: En `~/.openclaw/admin/credentials.json` (hashed con SHA-256 + salt).

**Q: ¿Cómo cambio el superadmin?**
R: Modifica `superadmin.telegramUserId` en la configuración y reinicia el gateway.

**Q: ¿Qué pasa si pierdo acceso a Telegram?**
R: Puedes deshabilitar temporalmente el 2FA desde la línea de comandos con `openclaw config set admin.require2FA=false`.

### Usuarios

**Q: ¿Por qué no puedo usar ciertos comandos?**
R: Como usuario público, solo tienes acceso a tools seguras. Contacta al administrador si necesitas más funcionalidades.

**Q: ¿Mis mensajes son privados?**
R: Sí, solo el administrador y el bot tienen acceso a tus mensajes.

---

## Solución de Problemas

### Problema: No recibo códigos de verificación en Telegram

**Causas posibles:**
1. Bot no configurado correctamente
2. `superadmin.telegramUserId` incorrecto
3. Bot no tiene permisos para enviar mensajes

**Solución:**
```bash
# Verificar configuración
openclaw config get superadmin

# Verificar que el bot puede enviar mensajes
curl -X POST "https://api.telegram.org/bot<TOKEN>/sendMessage" \
  -d "chat_id=<USER_ID>&text=Test"
```

### Problema: Usuarios públicos pueden usar tools prohibidas

**Causa:** Configuración incorrecta de roles

**Solución:**
```bash
# Verificar configuración de tools
openclaw config get tools.publicAllowed

# Reiniciar gateway
openclaw gateway restart
```

### Problema: API empresarial no responde

**Causas posibles:**
1. URL incorrecta
2. Problemas de autenticación
3. API externa caída

**Solución:**
1. Verificar URL en Panel Admin > APIs
2. Revisar logs: `openclaw logs --tail 100`
3. Probar API manualmente con curl

### Problema: No puedo acceder al panel admin

**Causas posibles:**
1. Sesión expirada
2. Credenciales incorrectas
3. Rate limiting

**Solución:**
```bash
# Limpiar sesión
rm ~/.openclaw/admin/sessions.json

# Recrear cuenta admin
openclaw admin reset
```

---

## 📞 Soporte

Si encuentras problemas no documentados:

1. Revisa los logs: `openclaw logs`
2. Consulta la documentación técnica: `docs/transformation/`
3. Abre un issue en GitHub

---

**¡Gracias por usar OpenClaw!** 🤖
