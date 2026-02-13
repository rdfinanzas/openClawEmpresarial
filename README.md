# 🦞 OpenClaw Empresarial

<p align="center">
  <img src="https://raw.githubusercontent.com/openclaw/openclaw/main/docs/assets/openclaw-logo-text.png" alt="OpenClaw Empresarial" width="400">
</p>

<p align="center">
  <strong>🤖 Asistente de IA Multi-Canal para Negocios</strong><br>
  <em>Automatización inteligente con control total de tus datos</em>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="Licencia MIT"></a>
  <a href="#"><img src="https://img.shields.io/badge/versión-empresarial-ff6b6b?style=for-the-badge" alt="Versión Empresarial"></a>
</p>

---

> 🏆 **Versión mejorada por**: @rdfinanzas (Hector)  
> 📅 **Última actualización**: Febrero 2026  
> 🔄 **Basado en**: OpenClaw original + Mejoras empresariales

---

## 🎯 ¿Qué es OpenClaw Empresarial?

**OpenClaw Empresarial** es una **versión mejorada** de OpenClaw diseñada específicamente para **negocios y empresas** que necesitan:

- ✅ **Múltiples cuentas de WhatsApp** (ventas, soporte, compras, VIP)
- ✅ **Sistema de doble personalidad** (ventas público + admin privado)
- ✅ **Wizard unificado** en español (un solo comando configura todo)
- ✅ **Soporte para LLMs chinos** (Kimi, GLM, DeepSeek, Qwen)
- ✅ **Integración simplificada** de APIs empresariales
- ✅ **Panel de administración web** para gestión centralizada

> 🎭 **Diferencia clave**: El sistema automáticamente escala conversaciones de ventas a admin cuando detecta consultas complejas o intentos de manipulación.

---

## 🚀 Inicio Rápido (Un solo comando)

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

Hay **dos formas** de usar OpenClaw Empresarial:

### Opción 1: Instalar desde npm (Recomendada - Más fácil)

Esta opción instala OpenClaw ya compilado, listo para usar:

```bash
# 1. Instalar OpenClaw globalmente (ya incluye todo compilado)
npm install -g openclaw@latest

# 2. Ejecutar el asistente de configuración
openclaw onboard --install-daemon

# 3. Iniciar el gateway
openclaw gateway --port 18789
```

> ℹ️ **Nota**: Esta opción instala el paquete oficial desde npm. Si quieres usar esta versión empresarial modificada, necesitas la Opción 2.

---

### Opción 2: Desarrollo desde el código fuente (Este Repositorio)

Usa esta opción si quieres modificar el código o usar las funcionalidades empresariales personalizadas:

#### Requisitos

- **Node.js**: 22+ 
- **Sistema operativo**: Windows 10/11, macOS, Linux
- **RAM**: 4GB mínimo recomendado
- **Puerto**: 18789 disponible

#### Instalación Rápida (Windows)

```powershell
# 1. Clonar el repositorio
git clone https://github.com/rdfinanzas/openClawEmpresarial.git
cd openClawEmpresarial

# 2. Ejecutar el script de inicio (maneja todo automáticamente)
.\start-system.ps1

# O con parámetros específicos
.\start-system.ps1 -DevMode -Port 8080
```

#### Instalación Manual

```bash
# 1. Clonar el repositorio
git clone https://github.com/rdfinanzas/openClawEmpresarial.git
cd openClawEmpresarial

# 2. Instalar dependencias (npm o pnpm)
npm install
# o: pnpm install

# 3. Iniciar (compila automáticamente si es necesario)
npm run start:npm
```

### Configuración Inicial

La primera vez que ejecutes el sistema, se creará un archivo `config.json` básico. Para configuración empresarial completa:

```bash
# Configurar modo empresarial
node scripts/run-node.mjs enterprise setup
```

O crea manualmente `config.json`:

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

### Iniciar el Sistema (desde código fuente)

```bash
# Opción A: npm puro (sin necesidad de pnpm)
npm run start:npm

# Opción B: Con pnpm (si lo tienes instalado)
pnpm start

# Opción C: Script de Windows
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

---

## 🏆 Créditos y Mejoras

### Versión Original
- **OpenClaw**: https://github.com/openclaw/openclaw
- **Autor**: Peter Steinberger y comunidad
- **Licencia**: MIT

### Mejoras de Esta Versión Empresarial

Esta versión fue **mejorada y adaptada** por **@rdfinanzas (Hector)** con las siguientes características:

#### ✨ Nuevas Características
| Feature | Descripción |
|---------|-------------|
| 🎯 **Wizard Unificado** | Un solo comando (`openclaw onboard`) configura todo: modelo LLM, Telegram, WhatsApp multi-cuenta y personalidades empresariales |
| 🇨🇳 **LLMs Chinos** | Soporte nativo para Kimi, GLM, DeepSeek, Qwen, MiniMax |
| 📱 **WhatsApp Multi-Cuenta** | Configura ventas, soporte, compras y VIP desde el wizard |
| 🤖 **Telegram Admin** | Canal de administración obligatorio con acceso total |
| 🎭 **Doble Personalidad** | Ventas (restringido) + Admin (completo) con escalada automática |
| 📚 **Documentación en Español** | Toda la documentación adaptada al español |
| 🎨 **UI Mejorada** | Interfaz de wizard con títulos grandes y flujo guiado |

#### 🔧 Cambios Técnicos
- Integración automática de onboard + enterprise
- Sistema de checkboxes para selección de expertise
- Generación dinámica de QR según cantidad de cuentas
- Mejoras en seguridad y detección de pre-requisitos

#### 📁 Archivos Creados/Modificados
```
src/wizard/onboarding-unified.ts          (NUEVO - Wizard completo)
src/commands/auth-choice-options.ts       (MOD - DeepSeek agregado)
src/wizard/onboarding-enterprise.ts       (MOD - Simplificado)
WIZARD_UNIFICADO.md                       (NUEVO - Documentación)
WIZARD_COMPLETO.md                        (NUEVO - Especificación)
```

---

## 🙏 Agradecimientos

- A la comunidad de **OpenClaw** por el excelente proyecto base
- A **Peter Steinberger** por crear OpenClaw
- A todos los contribuidores del proyecto original

---

<p align="center">
  <strong>🦞 OpenClaw Empresarial</strong><br>
  <em>Automatización inteligente para tu negocio</em><br>
  <small>Mejorado por @rdfinanzas (Hector) | Febrero 2026</small>
</p>
