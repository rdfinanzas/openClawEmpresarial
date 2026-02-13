# 🦞 OpenClaw Empresarial

<p align="center">
  <strong>Asistente de IA Multi-Canal para Negocios</strong>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="Licencia MIT"></a>
</p>

**OpenClaw Empresarial** es una adaptación empresarial de OpenClaw que proporciona un asistente de IA personal ejecutable en tus propios servidores. Diseñado específicamente para negocios que necesitan automatizar comunicaciones con clientes mientras mantienen control total sobre sus datos y conversaciones.

> 🎯 **Diferencia clave**: Sistema de **doble personalidad** que separa interacciones públicas (ventas) de privadas (administración), con controles de seguridad empresarial robustos.

---

## ✨ Características Empresariales

### 1. 🎭 Sistema de Doble Personalidad

| Personalidad | Canal | Función |
|-------------|-------|---------|
| **Ventas** (Pública) | WhatsApp, Discord | Atención al cliente, consultas de productos |
| **Admin** (Privada) | Telegram, Control UI | Gestión completa, alertas de seguridad |

- **Modo Ventas**: Acceso limitado, sin comandos de sistema, validación anti-manipulación
- **Modo Admin**: Acceso completo, recepción de alertas, toma de control de conversaciones

### 2. 📱 Multi-Cuenta WhatsApp Empresarial

Configura múltiples cuentas WhatsApp para diferentes funciones:

| Cuenta | Función | Uso |
|--------|---------|-----|
| **VENTAS** | Servicio al cliente | Consultas de productos, disponibilidad |
| **COMPRAS** | Gestión de proveedores | Órdenes de compra, inventario |
| **SOPORTE** | Soporte técnico | Tickets, troubleshooting |

### 3. 🔌 Integración de APIs Empresariales

Conecta OpenClaw con tus sistemas existentes:

- **CRM**: Salesforce, HubSpot, Zoho
- **ERP**: SAP, Oracle, Microsoft Dynamics
- **E-commerce**: Shopify, WooCommerce, Magento
- **Stock/Inventory**: APIs REST personalizadas
- **Pasarelas de pago**: Stripe, PayPal, MercadoPago

**Métodos soportados**: GET, POST, PUT, PATCH, DELETE  
**Autenticación**: Bearer Token, API Key, Basic Auth, OAuth2

### 4. 🛡️ Seguridad Empresarial

- **Detección anti-ingeniería social**: Análisis semántico de mensajes
- **Alertas en tiempo real**: Notificaciones inmediatas al admin en Telegram
- **Escalamiento automático**: Redirige a humano cuando detecta manipulación
- **Sandboxing**: Aislamiento de sesiones no-admin
- **Allowlists**: Control de acceso por usuario/canal

### 5. 🌐 Canales de Mensajería Soportados

- **WhatsApp** (Baileys Web)
- **Telegram** (grammY)
- **Discord** (discord.js)
- **Slack** (Socket Mode)
- **Google Chat** (Chat API)
- **Signal** (signal-cli)
- **iMessage** (imsg CLI)
- **WebChat** (Gateway WebSocket)
- **Extensiones**: Microsoft Teams, Matrix, Zalo, Mattermost

---

## 🚀 Inicio Rápido

### Requisitos

- **Node.js**: 22+ 
- **Sistema operativo**: Windows 10/11, macOS, Linux
- **RAM**: 4GB mínimo recomendado
- **Puerto**: 18789 disponible

### Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/rdfinanzas/openClawEmpresarial.git
cd openClawEmpresarial

# 2. Instalar dependencias
npm install
# o: pnpm install

# 3. Configurar el sistema empresarial
npm run enterprise:setup
# o ejecuta directamente: node scripts/run-node.mjs enterprise setup
```

### Configuración Inicial

#### Opción A: Usando el Wizard (Recomendado)

```powershell
# Windows
.\start-system.ps1

# O con parámetros específicos
.\start-system.ps1 -DevMode -Port 8080
```

#### Opción B: Configuración Manual

Crea `config.json` en la raíz del proyecto:

```json
{
  "gateway": {
    "port": 18789,
    "bind": "loopback"
  },
  "channels": {
    "whatsapp": {
      "enabled": true,
      "allowFrom": ["+5491112345678"]
    },
    "telegram": {
      "enabled": true,
      "botToken": "TU_BOT_TOKEN"
    }
  },
  "enterprise": {
    "dualPersonality": true,
    "securityAlerts": true,
    "autoEscalation": true,
    "apis": []
  },
  "agents": {
    "default": "openclaw",
    "sales": {
      "personality": "sales",
      "restricted": true
    },
    "admin": {
      "personality": "admin",
      "restricted": false
    }
  }
}
```

### Iniciar el Sistema

```bash
# Modo desarrollo
npm run dev

# Modo producción
npm start

# O usando el script de Windows
.\start-system.ps1
```

El panel de administración estará disponible en: `http://localhost:18789/admin`

---

## 📋 Comandos CLI Empresariales

```bash
# Configuración
openclaw enterprise setup              # Configurar modo empresarial
openclaw enterprise status             # Ver configuración actual
openclaw enterprise reconfigure        # Actualizar personalidades

# Pruebas
openclaw enterprise test-sales         # Probar personalidad de ventas
openclaw enterprise test-admin         # Probar personalidad de admin

# Gestión de APIs
openclaw enterprise apis               # Listar APIs configuradas
openclaw enterprise apis add           # Añadir nueva API
openclaw enterprise apis remove        # Eliminar API
openclaw enterprise test-api <id>      # Probar conexión API

# Canales
openclaw channels login                # Vincular WhatsApp (escanear QR)
openclaw channels status               # Ver estado de canales
openclaw pairing approve <canal> <codigo>  # Aprobar usuario

# Diagnóstico
openclaw doctor                        # Verificar configuración
```

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    OPENCLAW EMPRESARIAL                      │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐    ┌─────────────────┐    ┌──────────────┐
│   CANALES    │    │     GATEWAY     │    │   AGENTES    │
│  DE ENTRADA  │◄──►│   (Control Hub) │◄──►│     IA       │
└──────────────┘    └─────────────────┘    └──────────────┘
        │                     │                     │
        │            ┌────────┴────────┐            │
        │            │                 │            │
        ▼            ▼                 ▼            ▼
┌──────────────┐ ┌──────────┐   ┌──────────┐ ┌──────────────┐
│  WHATSAPP    │ │ Control  │   │  APIs    │ │   VENTAS     │
│  - VENTAS    │ │   UI     │   │EXTERNAS  │ │   (Público)  │
│  - COMPRAS   │ │ (Web)    │   │          │ │              │
│  - SOPORTE   │ └──────────┘   └──────────┘ │   ADMIN      │
└──────────────┐                             │   (Privado)  │
│  TELEGRAM    │                             └──────────────┘
│  (Admin)     │
└──────────────┘
│   DISCORD    │
│  (Público)   │
└──────────────┘
```

---

## 💼 Casos de Uso

### E-commerce con Atención al Cliente
- **WhatsApp VENTAS**: Consultas de productos, disponibilidad, precios
- **WhatsApp COMPRAS**: Gestión de inventario con proveedores
- **Telegram Admin**: Supervisión, alertas de seguridad
- **APIs**: Sistema de stock, pasarela de pagos, logística

### Servicios Profesionales (Consultoría, Legal, etc.)
- **WhatsApp**: Agendamiento de citas, consultas iniciales
- **Discord**: Comunidad de clientes, FAQs
- **Telegram Admin**: Casos complejos, documentación sensible
- **APIs**: Calendario, CRM, facturación

### Soporte Técnico
- **WhatsApp SOPORTE**: Tickets nivel 1, troubleshooting básico
- **Escalamiento**: Casos complejos al equipo técnico senior
- **Telegram Admin**: Gestión de incidencias críticas
- **APIs**: Sistema de tickets, monitoreo

---

## ⚙️ Configuración Avanzada

### Configuración de APIs Externas

```json
{
  "enterprise": {
    "apis": [
      {
        "id": "inventory-api",
        "name": "Sistema de Inventario",
        "baseUrl": "https://api.miempresa.com",
        "auth": {
          "type": "bearer",
          "token": "${INVENTORY_TOKEN}"
        },
        "endpoints": [
          {
            "path": "/stock/{productId}",
            "method": "GET",
            "description": "Consultar stock de producto"
          },
          {
            "path": "/orders",
            "method": "POST",
            "description": "Crear orden de compra"
          }
        ]
      }
    ]
  }
}
```

### Configuración de Seguridad

```json
{
  "security": {
    "dmPolicies": {
      "whatsapp": "pairing",
      "telegram": "open"
    },
    "allowlists": {
      "whatsapp": ["+5491112345678", "+5491187654321"],
      "telegram": ["@admin_usuario"]
    },
    "sandbox": {
      "mode": "non-main",
      "allowlist": ["bash", "read", "write", "sessions_send"],
      "denylist": ["browser", "canvas", "cron"]
    }
  }
}
```

---

## 🔧 Solución de Problemas

### Gateway no inicia
```bash
# Verificar puerto disponible
netstat -ano | findstr 18789

# Ver logs
openclaw gateway run --verbose

# Validar configuración
openclaw config validate
```

### WhatsApp no conecta
```bash
# Verificar estado
openclaw channels status

# Reescanear QR si es necesario
openclaw channels login

# Verificar sesión
ls ~/.openclaw/credentials/
```

### APIs no responden
```bash
# Testear conexión
openclaw enterprise test-api <id>

# Verificar credenciales
cat ~/.openclaw/credentials/api-*
```

---

## 📚 Documentación

- [Guía de Inicio Rápido](QUICKSTART.md)
- [Guía de Inicio Rápido Admin](QUICKSTART-ADMIN.md)
- [Cómo funciona la Configuración](COMO-FUNCIONA-CONFIGURACION.md)
- [Flujo del Sistema](FLUJO-SISTEMA.md)
- [Arquitectura Admin Unificado](ARQUITECTURA_ADMIN_UNIFICADO.md)
- [Plan de Transformación](PLAN_TRANSFORMACION_OPENCLAW.md)

---

## 🤝 Contribuir

Este proyecto es un fork de [OpenClaw](https://github.com/openclaw/openclaw) adaptado para casos de uso empresarial.

---

## 📄 Licencia

MIT License - ver [LICENSE](LICENSE) para detalles.

---

<p align="center">
  <strong>🦞 OpenClaw Empresarial</strong><br>
  Automatización inteligente para tu negocio
</p>
