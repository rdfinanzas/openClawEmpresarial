# OpenClaw Empresarial - Análisis e Implementación

## Resumen Ejecutivo

**OpenClaw** es una plataforma de asistente de IA personal que se ejecuta en tus propios dispositivos. Funciona como un gateway multi-canal con integraciones de mensajería extensibles, permitiendo comunicación con IA a través de múltiples canales de mensajería. La versión empresarial ofrece funcionalidades avanzadas para negocios incluyendo bots de doble personalidad, integración de APIs externas, y controles de seguridad robustos.

---

## Arquitectura General

### 1. Componentes Principales

#### Gateway (src/gateway/)
- **WebSocket control plane** (puerto por defecto 18789)
- Hub central que gestiona todas las conexiones de superficies de mensajería
- Administra sesiones, presencia, configuración, cron jobs, webhooks
- Sirve Control UI y WebChat directamente
- Emite eventos: `agent`, `chat`, `presence`, `health`, `heartbeat`, `cron`

#### CLI (src/cli/, src/commands/)
- Interfaz principal mediante comando `openclaw`
- Comandos clave:
  - `openclaw onboard` - Asistente de configuración inicial
  - `openclaw gateway` - Iniciar gateway
  - `openclaw agent` - Conversar con IA
  - `openclaw enterprise setup` - Configuración empresarial
  - `openclaw channels` - Gestión de canales
  - `openclaw config` - Gestión de configuración

#### Sistema de Agentes (src/agents/)
- Enrutamiento multi-agente con aislamiento
- Workspaces, sesiones y sandboxing por agente
- Comunicación agente-a-agente mediante herramientas `sessions_*`
- Configuración de personalidad para modo empresarial dual

#### Canales de Mensajería (src/channels/)
Integraciones con múltiples plataformas:
- **WhatsApp** (via Baileys Web)
- **Telegram** (via grammY)
- **Discord** (via discord.js)
- **Slack** (Socket Mode)
- **Google Chat** (Chat API)
- **Signal** (signal-cli)
- **iMessage** (via imsg CLI)
- **WebChat** (Gateway WebSocket)
- **Extensiones**: Microsoft Teams, Matrix, Zalo, Mattermost, BlueBubbles, y más

### 2. Flujo de Datos

```
Usuario → Canal (WhatsApp/Telegram/etc) → Gateway → Agente IA → Respuesta
                    ↓
              Web Provider (Control UI)
```

---

## Funcionalidades Empresariales

### 1. Sistema de Doble Personalidad

#### Personalidad de Ventas (Pública)
- **Canales**: WhatsApp, Discord (público)
- **Acceso limitado**: Sin comandos de sistema, sin búsqueda web
- **Áreas de expertise predefinidas**: Catálogo, precios, disponibilidad
- **Restricciones de seguridad**: Validación de consultas, detección de ingeniería social
- **Escalamiento automático**: Redirige a admin cuando detecta intentos de manipulación

#### Personalidad de Administrador (Privada)
- **Canales**: Telegram (privado), Control UI
- **Acceso completo**: Todos los comandos y herramientas del sistema
- **Recepción de alertas**: Notificaciones de seguridad en tiempo real
- **Toma de control**: Puede intervenir conversaciones de ventas
- **Gestión de agentes**: Configura y supervisa agentes de ventas

### 2. Multi-Cuenta WhatsApp Empresarial

Configuración de múltiples cuentas WhatsApp para diferentes funciones:

| Cuenta | Función | Descripción |
|--------|---------|-------------|
| **VENTAS** | Servicio al cliente público | Atención a clientes, consultas de productos |
| **COMPRAS** | Gestión de proveedores | Órdenes de compra, seguimiento de inventario |
| **SOPORTE** | Soporte técnico | Resolución de problemas técnicos |
| Personalizada | Cualquier función específica | Configurable según necesidades |

### 3. Integración de APIs Empresariales

#### Gestor de APIs (src/enterprise/)

**api-manager.ts**: Gestiona integraciones externas
- Conexión a cualquier API REST (stock, órdenes, citas, etc.)
- Soporta métodos: GET, POST, PUT, PATCH, DELETE
- Autenticación: Bearer Token, API Key, Basic Auth, OAuth2
- Generación dinámica de herramientas IA desde definiciones de API

**dynamic-api-manager.ts**: Configuración runtime de APIs
- Añadir/quitar APIs sin reiniciar
- Configuración de endpoints y parámetros
- Gestión de credenciales segura

**tool-generator.ts**: Generador de herramientas IA
- Crea herramientas automáticamente desde especificaciones OpenAPI/Swagger
- Mapeo de parámetros entre conversación natural y API
- Documentación inline para el agente

**api-executor.ts**: Ejecutor de APIs
- Ejecución segura de llamadas API
- Manejo de errores y reintentos
- Logging de auditoría

### 4. Características de Seguridad

#### Detección Anti-Ingeniería Social
- **Análisis semántico**: Detecta patrones de manipulación en mensajes
- **Palabras clave sensibles**: Identifica intentos de obtener credenciales
- **Validación de contexto**: Verifica que las consultas sean legítimas
- **Bloqueo proactivo**: Previene respuestas a consultas maliciosas

#### Sistema de Alertas
- **Alertas en tiempo real**: Notificaciones inmediatas al admin
- **Canales de alerta**: Telegram prioritario, email, webhook
- **Clasificación de severidad**: Crítica, Alta, Media, Baja
- **Logs de auditoría**: Trazabilidad completa de eventos de seguridad

#### Control de Acceso Basado en Roles
- **Roles por canal**: Permisos específicos por canal de comunicación
- **Sandboxing**: Aislamiento de sesiones no-admin
- **Allowlists**: Listas blancas de usuarios/contactos autorizados
- **Políticas DM**: Control de mensajes directos

### 5. Sistema de Escalamiento

#### Triggers Automáticos
- Detección de frases sensibles ("olvido mi contraseña", "acceso de emergencia")
- Consultas fuera del scope de ventas
- Intentos de manipulación detectados
- Solicitudes explícitas de hablar con humano

#### Proceso de Escalamiento
1. **Detección**: Agente de ventas identifica situación que requiere admin
2. **Notificación**: Envía mensaje a admin vía `sessions_send`
3. **Contexto**: Incluye historial de conversación y razón de escalamiento
4. **Intervención**: Admin puede tomar control o responder directamente
5. **Resolución**: Admin responde o delega de vuelta a ventas

---

## Comandos CLI Empresariales

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
```

---

## Estructura de Configuración

### Ubicación
`~/.openclaw/openclaw.json` (formato JSON5)

### Secciones Principales

```json5
{
  // Agentes
  agents: {
    main: { /* Agente principal */ },
    sales: { /* Agente de ventas */ },
    support: { /* Agente de soporte */ }
  },
  
  // Canales
  channels: {
    whatsapp: { /* Config WhatsApp */ },
    telegram: { /* Config Telegram */ },
    discord: { /* Config Discord */ }
  },
  
  // Empresarial
  enterprise: {
    businessPersonality: {
      sales: { /* Personalidad ventas */ },
      admin: { /* Personalidad admin */ }
    },
    apis: [ /* APIs integradas */ ],
    features: {
      dualPersonality: true,
      securityAlerts: true,
      autoEscalation: true
    }
  },
  
  // Gateway
  gateway: {
    port: 18789,
    auth: { /* Configuración auth */ },
    tailscale: { /* Config Tailscale */ }
  },
  
  // Modelos
  models: {
    default: "claude-sonnet-4-20250514",
    providers: { /* Config proveedores */ }
  },
  
  // Seguridad
  security: {
    dmPolicies: { /* Políticas DM */ },
    allowlists: { /* Listas blancas */ },
    sandbox: { /* Config sandbox */ }
  }
}
```

---

## Casos de Uso Empresariales

### 1. E-commerce con Atención al Cliente
- **WhatsApp VENTAS**: Consultas de productos, disponibilidad, precios
- **WhatsApp COMPRAS**: Gestión de inventario con proveedores
- **Telegram Admin**: Supervisión, alertas de seguridad, consultas complejas
- **APIs**: Integración con sistema de stock, pasarela de pagos, logística

### 2. Servicios Profesionales (Consultoría, Legal, etc.)
- **WhatsApp**: Agendamiento de citas, consultas iniciales
- **Discord**: Comunidad de clientes, FAQs
- **Telegram Admin**: Casos complejos, documentación sensible
- **APIs**: Calendario, CRM, facturación

### 3. Soporte Técnico
- **WhatsApp SOPORTE**: Tickets nivel 1, troubleshooting básico
- **Escalamiento**: Casos complejos al equipo técnico senior
- **Telegram Admin**: Gestión de incidencias críticas
- **APIs**: Sistema de tickets, monitoreo, base de conocimiento

### 4. Ventas B2B
- **WhatsApp VENTAS**: Prospectos, cotizaciones, seguimiento
- **WhatsApp COMPRAS**: Gestión con proveedores
- **Telegram Admin**: Negociaciones importantes, aprobaciones
- **APIs**: CRM, ERP, sistema de cotizaciones

---

## Diagrama de Arquitectura Empresarial

```
┌─────────────────────────────────────────────────────────────┐
│                    OPENCLAW ENTERPRISE                       │
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

┌─────────────────────────────────────────────────────────────┐
│                    SEGURIDAD                                │
│  • Detección anti-ing. social                               │
│  • Alertas en tiempo real                                   │
│  • Control de acceso por roles                              │
│  • Sandboxing                                               │
│  • Escalamiento automático                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Requisitos Técnicos

### Sistema
- **Node.js**: 22+ (runtime principal)
- **Bun**: Alternativa para ejecución TypeScript
- **Sistema operativo**: macOS, Linux, Windows

### Dependencias Clave
- **Gateway**: WebSocket server, JSON Schema validation
- **Canales**: Baileys (WhatsApp), grammY (Telegram), discord.js (Discord)
- **IA**: Anthropic Claude, OpenAI GPT (vía providers)
- **Seguridad**: Crypto, JWT, sandboxing

### Infraestructura Recomendada
- **Gateway**: Servidor dedicado o VPS (4GB+ RAM)
- **Conexión**: Internet estable para WebSocket
- **Almacenamiento**: SSD para logs y sesiones
- **Backup**: Configuración en `~/.openclaw/`

---

## Mejores Prácticas de Implementación

### 1. Configuración Inicial
1. Ejecutar `openclaw onboard` para setup inicial
2. Configurar `openclaw enterprise setup` para modo empresarial
3. Conectar canales uno por uno (WhatsApp primero, luego Telegram, etc.)
4. Probar cada canal con `openclaw enterprise test-*`

### 2. Seguridad
- Mantener token de admin en canal privado (Telegram)
- Configurar allowlists para canales públicos
- Revisar regularmente logs de seguridad
- Mantener actualizado OpenClaw (`npm i -g openclaw@latest`)

### 3. APIs Externas
- Usar variables de entorno para credenciales sensibles
- Implementar rate limiting en APIs
- Monitorear uso y costos de APIs
- Documentar todas las integraciones

### 4. Mantenimiento
- Revisar `openclaw doctor` periódicamente
- Actualizar extensiones cuando haya nuevas versiones
- Hacer backup de `~/.openclaw/` regularmente
- Monitorear recursos del servidor (CPU, RAM, disco)

---

## Troubleshooting Común

### Gateway no inicia
- Verificar puerto 18789 disponible: `ss -ltnp | grep 18789`
- Revisar logs: `openclaw gateway run` en modo verbose
- Comprobar configuración: `openclaw config validate`

### WhatsApp no conecta
- Verificar sesión: `openclaw channels status`
- Reescanear QR si es necesario
- Comprobar conexión a internet

### APIs no responden
- Testear con `openclaw enterprise test-api <id>`
- Verificar credenciales y permisos
- Comprobar URL y endpoints

### Alertas de seguridad falsas
- Ajustar sensibilidad en configuración
- Revisar logs para entender contexto
- Actualizar palabras clave de detección

---

## Conclusión

OpenClaw Empresarial proporciona una plataforma completa para automatizar comunicaciones empresariales mediante IA, manteniendo el control y seguridad necesarios para entornos de producción. El sistema de doble personalidad permite separar claramente las interacciones públicas de las privadas, mientras que la integración de APIs permite conectar con sistemas existentes para crear flujos de trabajo automatizados.

La arquitectura modular permite escalar desde un único emprendedor hasta equipos empresariales grandes, con soporte para múltiples canales y agentes especializados.

---

*Documento generado el: 2026-02-13*
*Versión de OpenClaw: Consultar package.json*
*Repositorio: https://github.com/openclaw/openclaw*
