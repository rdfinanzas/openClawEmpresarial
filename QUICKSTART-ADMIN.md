# 🚀 Quickstart - OpenClaw Admin Unificado

Guía rápida para iniciar el sistema completo con Wizard de configuración y Admin Panel.

## 📋 Requisitos

- Node.js 22+ 
- npm (viene con Node)
- Telegram Bot Token (opcional, para 2FA)
- API Keys (OpenAI/Anthropic/etc)

---

## 🏁 Paso 1: Instalar Dependencias

```bash
npm install
```

---

## ⚙️ Paso 2: Iniciar el Wizard de Configuración

### Wizard Empresarial (Recomendado)

```bash
# Configuración completa con dual-personality (Ventas/Admin)
node scripts/run-node.mjs enterprise setup
```

### Wizard Básico

```bash
# Configuración simple
node scripts/run-node.mjs wizard
```

### Configuración Manual

```bash
# Crear config.json manualmente
node scripts/run-node.mjs config init
```

---

## 🤖 Paso 3: Configurar Canales

### Telegram (Requerido para 2FA Admin)

```bash
# Configurar Telegram Bot
node scripts/run-node.mjs channels telegram setup
```

### WhatsApp (Ventas)

```bash
# Escanear QR para WhatsApp Business
node scripts/run-node.mjs channels whatsapp login
```

### Discord (Ventas)

```bash
# Configurar Discord Bot
node scripts/run-node.mjs channels discord setup
```

### Email (SMTP)

```bash
# Configurar servidor SMTP para emails
node scripts/run-node.mjs channels email setup
```

---

## 🚀 Paso 4: Iniciar el Sistema

### Modo Desarrollo (con auto-reload)

```bash
# Iniciar gateway con admin panel
npm run gateway:dev

# O con reset de config
npm run gateway:dev:reset
```

### Modo Producción

```bash
# Build primero
npm run build

# Iniciar gateway
node dist/gateway/index.js
```

### Con Channels (Producción)

```bash
# Sin skip de channels
node scripts/run-node.mjs gateway
```

---

## 🌐 Acceder al Admin Panel

Una vez iniciado el gateway:

```
http://localhost:18789/admin
```

### Primer Login

1. Abrir `/admin` en navegador
2. Si no hay cuenta admin, se crea automáticamente:
   - Username: `admin`
   - Password: (la que configures)
3. Recibirás código por Telegram (2FA)
4. Ingresar código de 6 dígitos
5. ¡Listo! Acceso al Dashboard

---

## 📧 Configuración de Email

### Opción 1: Gmail SMTP

```json
{
  "channels": {
    "email": {
      "enabled": true,
      "smtp": {
        "host": "smtp.gmail.com",
        "port": 587,
        "secure": false,
        "auth": {
          "user": "tu-email@gmail.com",
          "pass": "tu-app-password"
        }
      }
    }
  }
}
```

### Opción 2: SendGrid

```json
{
  "channels": {
    "email": {
      "enabled": true,
      "sendgrid": {
        "apiKey": "SG.xxx"
      }
    }
  }
}
```

### Opción 3: AWS SES

```bash
node scripts/run-node.mjs channels email setup --provider ses
```

---

## 🧪 Comandos Útiles

### Ver estado del sistema

```bash
# Health check
node scripts/run-node.mjs doctor

# Estado de canales
node scripts/run-node.mjs channels status

# Estado detallado
node scripts/run-node.mjs channels status --probe
```

### Logs

```bash
# Ver logs del gateway
tail -f /tmp/openclaw-gateway.log

# En Windows
Get-Content \tmp\openclaw-gateway.log -Wait
```

### Configuración

```bash
# Ver configuración actual
node scripts/run-node.mjs config get

# Setear valor
node scripts/run-node.mjs config set gateway.port 18789

# Editar manualmente
node scripts/run-node.mjs config edit
```

---

## 🔧 Troubleshooting

### Error: "Cannot find module"

```bash
# Reinstalar dependencias
rm -rf node_modules
npm install
```

### Error: "Port already in use"

```bash
# Matar proceso en puerto 18789
# Windows:
netstat -ano | findstr :18789
taskkill /PID <PID> /F

# Linux/Mac:
lsof -ti:18789 | xargs kill -9
```

### Error: "Channels not configured"

```bash
# Saltar verificación de canales
set OPENCLAW_SKIP_CHANNELS=1
node scripts/run-node.mjs gateway
```

### Error de autenticación en Admin

```bash
# Resetear credenciales admin
node scripts/run-node.mjs admin reset-password
```

---

## 📁 Estructura de Archivos Importantes

```
openclaw-main/
├── config.json              # Configuración principal
├── src/web/admin/           # Código del Admin Panel
│   ├── index.ts            # Router y templates HTML
│   ├── auth.ts             # Lógica de 2FA
│   └── middleware.ts       # Protección de rutas
├── src/wizard/             # Wizard de configuración
│   └── onboarding-enterprise.ts
└── docs/                   # Documentación
```

---

## 🌟 Flujo Completo de Inicio

```bash
# 1. Instalar
npm install

# 2. Configurar empresa (wizard interactivo)
node scripts/run-node.mjs enterprise setup

# 3. Configurar Telegram (para 2FA)
node scripts/run-node.mjs channels telegram setup

# 4. Configurar WhatsApp (opcional)
node scripts/run-node.mjs channels whatsapp login

# 5. Iniciar gateway
npm run gateway:dev

# 6. Abrir admin
start http://localhost:18789/admin
```

---

## 🆘 Soporte

- Documentación: `docs/`
- Logs: `/tmp/openclaw-gateway.log`
- Comando ayuda: `node scripts/run-node.mjs --help`
