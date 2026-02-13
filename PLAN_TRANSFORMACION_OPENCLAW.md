# Plan de Transformación: OpenClaw Bot de Atención al Público

## Resumen Ejecutivo

Transformar OpenClaw de un asistente AI personal (propietario único) a un bot de atención al público con las siguientes características principales:

- **Telegram**: Canal exclusivo de configuración y administración (propietario)
- **Otros canales** (WhatsApp, Discord, Slack, etc.): Atención al p\u00fablico con limitaciones
- **Panel de configuración web**: Interfaz con autenticación para administrar el bot
- **Autorización root**: Solo mediante confirmación vía Telegram
- **APIs empresariales**: Integración para consultar stock, procesar pedidos, agendar citas

## Análisis del Proyecto Actual

### Arquitectura Existente

OpenClaw es un asistente AI personal multi-canal construido con Node.js/TypeScript que:

1. **Gateway centralizado** (`src/gateway/`):
   - WebSocket server en puerto 18789
   - Autenticación: token, password o Tailscale
   - Manejo de sesiones y enrutamiento de mensajes
   - Protocolo unificado para todos los canales

2. **Canales implementados** (`src/channels/`, `src/telegram/`, `src/whatsapp/`, etc.):
   - WhatsApp (vía Baileys)
   - Telegram (vía grammY)
   - Discord, Slack, Signal, iMessage, Google Chat
   - Cada canal con su `allowFrom` para controlar acceso

3. **Seguridad** (`src/security/`, `src/gateway/auth.ts`):
   - Sistema de allowlists por canal (IDs de usuario permitidos)
   - Políticas de grupo (mention gating, tool policies)
   - Pairing system para DMs no autorizados
   - Auditoría de seguridad (`openclaw security audit`)

4. **Configuración** (`src/config/`):
   - Archivo principal: `~/.openclaw/openclaw.json`
   - Variables de entorno en `.env`
   - Configuración por canal con `allowFrom`, grupos, etc.

5. **Agentes y sesiones** (`src/agents/`, `src/sessions/`):
   - Múltiples agentes con workspaces aislados
   - Sesiones independientes por conversación
   - Sistema de tools y skills

### Funcionalidad Actual

- **Uso personal**: Diseñado para un propietario único
- **Canales múltiples**: Todos los canales pueden comunicarse con el bot
- **Sin límites de uso**: Pensado para uso personal, no público
- **Sin panel web de config**: Configuración por CLI y archivos JSON/env
- **Sin diferenciación de roles**: Todos los ch con permisos similares

### Seguridad Actual

- `allowFrom`: Lista de usuarios permitidos por canal
- `dmPolicy`: "pairing" (requiere aprobación) o "open" (abierto)
- `groupPolicy`: Control de menciones y herramientas en grupos
- Autenticación del Gateway: token/password/Tailscale
- **Sin rate limiting**: No hay limitación de uso por usuario

## Revisión Requerida por el Usuario

> [!WARNING]
> **Cambios Críticos de Arquitectura**
> Esta transformación implica cambios fundamentales en el modelo de uso de OpenClaw:
> 
> 1. **Separación de roles**: Telegram será canal exclusivo de admin, otros canales para público
> 2. **Limitaciones de uso**: Se implementarán rate limits y quotas para usuarios públicos
> 3. **Panel web expuesto**: Requiere hardening de seguridad (actualmente NO recomendado para exposición pública)
> 4. **Autorizaciones críticas**: Solo vía Telegram (ej: acceso root, cambios de configuración)
> 5. **APIs empresariales**: Nuevas integraciones con sistemas externos (pueden requerir credenciales)

> [!IMPORTANT]
> **Decisiones de Diseño Requeridas**
> 
> Antes de proceder, necesito tu confirmación sobre:
> 
> **1. Segregación de canales:**
>    - ¿Telegram será SOLO para admin o también para atención pública limitada?
>    - ¿Qué canales específicos quieres usar para atención pública?
>    - ¿Deberían poder los usuarios públicos crear tickets/casos que el admin vea?
> 
> **2. Limitaciones para público:**
>    - ¿Qué límites aplicar? (ej: 10 mensajes/hora, 50 mensajes/día)
>    - ¿Costo/quota por usuario o global?
>    - ¿Qué herramientas/tools estarán disponibles para público vs admin?
> 
> **3. Panel de configuración web:**
>    - ¿Autenticación con usuario/password, OAuth, o Telegram Auth?
>    - ¿Qué funcionalidades debe tener el panel?
>    - ¿Dónde se desplegará? (local, VPS, cloud)
> 
> **4. Autorización root vía Telegram:**
>    - ¿Qué operaciones considerasroot"? (ej: cambiar config, acceder a datos sensibles)
>    - ¿Timeout para aprobaciones pendientes?
>    - ¿Múltiples administradores o solo uno?
> 
> **5. APIs empresariales:**
>    - ¿Qué sistema de stock/inventario usas?
>    - ¿Qué plataforma de pedidos/e-commerce?
>    - ¿Qué sistema de calendario/citas?
>    - ¿APIs REST, GraphQL, bases de datos directas?

## Cambios Propuestos

### 1. Arquitectura Multi-Rol

#### 1.1 Segregación de Canales

**Archivo**: Nueva configuración en `src/config/types.gateway.ts`

```typescript
export type ChannelRole = 'superadmin' | 'public';

export interface SuperAdminConfig {
  telegramUserId: number;  // ID único del superadmin
  activationKeyword?: string;  // Palabra clave para activar bot
  activated: boolean;  // Estado de activación
}

export interface ChannelRoleConfig {
  role: ChannelRole;
  allowedTools?: string[];  // Tools permitidos para este rol
  forbiddenCommands?: string[];  // Comandos prohibidos
}
```

**Archivo**: `src/telegram/superadmin-auth.ts` (NUEVO)

```typescript
// Autenticación restrictiva para Telegram
export class TelegramSuperAdminAuth {
  private superadminId: number;
  private activationKeyword: string;
  private isActivated: boolean = false;

  // Verificar si el mensaje viene del superadmin
  isSuperAdmin(userId: number): boolean {
    return userId === this.superadminId;
  }

  // Activar bot con palabra clave
  async handleActivation(message: string, userId: number): Promise<boolean> {
    if (!this.isSuperAdmin(userId)) {
      return false;  // Ignorar mensajes de otros usuarios
    }
    
    if (message.includes(this.activationKeyword)) {
      this.isActivated = true;
      return true;
    }
    
    return this.isActivated;
  }

  // Bloquear mensajes de usuarios no autorizados
  shouldProcessMessage(userId: number): boolean {
    return this.isSuperAdmin(userId) && this.isActivated;
  }
}
```

**Archivo**: Modificar `src/telegram/bot.ts`

Agregar filtro al principio del handler de mensajes:
```typescript
bot.on('message', async (ctx) => {
  const userId = ctx.from?.id;
  
  // BLOQUEO: Solo procesar mensajes del superadmin
  if (!superadminAuth.shouldProcessMessage(userId)) {
    // Ignorar silenciosamente mensajes de otros usuarios
    return;
  }
  
  // ... resto del processing
});
```

**Archivo**: `src/channels/roles.ts` (NUEVO)

```typescript
// Mapeo de canales a roles
export function getChannelRole(channelId: ChannelId): ChannelRole {
  if (channelId === 'telegram') {
    return 'superadmin';
  }
  return 'public';
}

// Validar si una operación está permitida para el rol
export function isOperationAllowed(
  role: ChannelRole,
  operation: string
): boolean {
  const publicForbiddenOps = [
    'file_delete',
    'system_exec',
    'config_write',
    'user_data_access',
    // ... más operaciones peligrosas
  ];
  
  if (role === 'superadmin') {
    return true;  // Superadmin puede todo
  }
  
  return !publicForbiddenOps.includes(operation);
}
```

#### 1.2 Sistema de Restricción de Herramientas

**Archivo**: `src/agents/tool-filter.ts` (NUEVO)

```typescript
// Filtrado de herramientas según rol del canal
export class ToolAccessFilter {
  // Herramientas PROHIBIDAS para público
  private readonly publicForbiddenTools = [
    'bash',  // Ejecución de comandos
    'file_delete',
    'file_write',
    'browser',
    'system_*',  // Cualquier comando del sistema
    'config_*',  // Cualquier modificación de configuración
    // ... más herramientas peligrosas
  ];

  // Herramientas PERMITIDAS para público (whitelist)
  private readonly publicAllowedTools = [
    'search',  // Búsqueda de información
    'enterprise_*',  // APIs empresariales
    'calendar_view',  // Ver calendario (read-only)
    // Herramientas que el admin configure
  ];

  canUseTool(role: ChannelRole, toolName: string): boolean {
    if (role === 'superadmin') {
      return true;  // Superadmin tiene acceso completo
    }

    // Para público: usar whitelist
    return this.publicAllowedTools.some(pattern => 
      this.matchPattern(toolName, pattern)
    );
  }

  filterToolsForRole(
    role: ChannelRole,
    availableTools: Tool[]
  ): Tool[] {
    if (role === 'superadmin') {
      return availableTools;  // Todas las herramientas
    }

    // Filtrar para público
    return availableTools.filter(tool =>
      this.canUseTool(role, tool.name)
    );
  }
}
```

**Archivo**: Modificar `src/agents/pi-embedded-helpers/tools.ts`

Agregar filtrado antes de exponer tools al agente:
```typescript
const toolFilter = new ToolAccessFilter();
const channelRole = getChannelRole(context.channelId);

// Filtrar tools según rol
const filteredTools = toolFilter.filterToolsForRole(
  channelRole,
  allAvailableTools
);

// Pasar solo tools permitidos al agente
return filteredTools;
```

### 2. Panel de Configuración Web

#### 2.1 Interfaz Web con Doble Autenticación

**Archivo**: `src/web/admin/auth.ts` (NUEVO)

```typescript
// Sistema de autenticación dual
export class AdminAuth {
  // Paso 1: Usuario/Password
  async loginWithPassword(
    username: string,
    password: string
  ): Promise<{ tempToken: string } | null> {
    // Verificar credenciales
    const isValid = await this.verifyCredentials(username, password);
    if (!isValid) return null;

    // Generar token temporal (válido 5 min)
    const tempToken = this.generateTempToken();
    
    // Enviar código a Telegram del superadmin
    await this.sendTelegramVerificationCode(tempToken);
    
    return { tempToken };
  }

  // Paso 2: Confirmación vía Telegram
  async verifyTelegramCode(
    tempToken: string,
    telegramCode: string
  ): Promise<{ sessionToken: string } | null> {
    // Verificar código recibido desde Telegram
    const isValid = await this.verifyTelegramCode(tempToken, telegramCode);
    if (!isValid) return null;

    // Generar sesión permanente
    const sessionToken = this.generateSessionToken();
    return { sessionToken };
  }
}
```

**Directorio**: `src/web/admin/` (NUEVO)

Componentes a crear:
- **`auth.ts`**: Doble autenticación (password + Telegram)
- **`dashboard.ts`**: Panel principal con métricas
- **`service-monitor.ts`**: **Monitoreo constante de fallas del servicio**
- **`config-editor.ts`**: Editor de configuración del bot
- **`api-manager.ts`**: Gestión de APIs empresariales dinámicas

**Archivo**: `src/web/admin/service-monitor.ts` (NUEVO)

```typescript
// Monitoreo en tiempo real del servicio
export class ServiceMonitor {
  // Verificar salud del gateway
  async checkGatewayHealth(): Promise<HealthStatus> {
    // Verificar WebSocket activo
    // Verificar canales conectados
    // Verificar memoria/CPU
    return status;
  }

  // Verificar canales
  async checkChannelHealth(): Promise<ChannelHealth[]> {
    const channels = ['telegram', 'whatsapp', 'slack', ...];
    const health = await Promise.all(
      channels.map(ch => this.probeChannel(ch))
    );
    return health;
  }

  // Alertas automáticas
  async monitorAndAlert(): Promise<void> {
    setInterval(async () => {
      const issues = await this.detectIssues();
      if (issues.length > 0) {
        // Enviar alerta a Telegram del superadmin
        await this.sendTelegramAlert(issues);
      }
    }, 60000); // Cada minuto
  }
}
```

**Archivo**: `src/web/admin/middleware.ts` (NUEVO)

```typescript
// Middleware de autenticación para rutas admin
export function requireAdminAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const sessionToken = req.headers.authorization;
  
  if (!adminAuth.validateSession(sessionToken)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Log de acceso
  logger.info('Admin access', {
    ip: req.ip,
    path: req.path,
    timestamp: Date.now()
  });
  
  next();
}
```

#### 2. Interface UI

**Directorio**: `ui/src/admin/` (NUEVO)

Crear componentes Lit para:
- Login form
- Dashboard con métricas
- Formulario de configuración
- Lista de usuarios activos
- Logs de actividad

### 3. Autorización Root via Telegram

#### 3.1 Sistema de Aprobaciones

**Archivo**: `src/telegram/root-authorization.ts` (NUEVO)

Implementar:
- Cola de solicitudes de autorización pendientes
- Envío de notificación a Telegram del admin
- Botones inline para aprobar/rechazar
- Timeout configurable para solicitudes
- Logging de todas las aprobaciones/rechazos

**Archivo**: `src/gateway/root-guard.ts` (NUEVO)

Middleware para:
- Interceptar operaciones que requieren autorización root
- Solicitar aprobación vía Telegram
- Bloquear ejecución hasta respuesta
- Manejar timeouts y cancellaciones

#### 3.2 Operaciones Protegidas

Definir qué operaciones requieren autorización:
- Cambios en configuración crítica
- Acceso a datos sensibles de usuarios
- Modificación de rate limits
- Instalación/desinstalación de skills/plugins
- Cambios en allowlists globales

### 4. Limitaciones para Canales Públicos

#### 4.1 Rate Limits

**Archivo**: Modificar `src/channels/dock.ts`

Agregar configuración de rate limits por canal:
```typescript
export interface ChannelDock {
  // ... existing props
  publicLimits?: {
    messagesPerHour?: number;
    messagesPerDay?: number;
    tokensPerDay?: number;
    concurrentRequests?: number;
  };
}
```

**Archivo**: `src/routing/rate-limit-middleware.ts` (NUEVO)

Implementar middleware que:
- Intercepta mensajes entrantes de canales públicos
- Consulta y actualiza contadores de rate limit
- Rechaza mensajes que excedan límites
- Envía mensaje explicativo al usuario

#### 4.2 Restricción de Herramientas

**Archivo**: Modificar `src/agents/pi-embedded-helpers/errors.ts`

Agregar validación de tools permitidos:
- Lista blanca de tools para usuarios públicos
- Denegación automática de tools privilegiados
- Mensajes de error informativos

**Archivo**: `src/tools/public-tools.ts` (NUEVO)

Definir subset de tools disponibles para público:
- Consultas de información (read-only)
- APIs empresariales expuestas
- SIN: exec, browser, file system, etc.

### 5. APIs Empresariales Dinámicas

#### 5.1 Sistema de APIs Configurables por Admin

**Archivo**: `src/enterprise/dynamic-api-manager.ts` (NUEVO)

```typescript
// Sistema donde el admin puede agregar APIs dinámicamente
export interface DynamicAPIConfig {
  id: string;
  name: string;
  description: string;  // El admin explica qué hace la API
  baseUrl: string;
  authType: 'bearer' | 'api-key' | 'oauth' | 'none';
  authCredentials?: {
    token?: string;
    apiKey?: string;
    // ... otros tipos de auth
  };
  endpoints: DynamicEndpoint[];
  purpose: string;  // Objetivo de la API según el admin
  usageExamples?: string[];  // Ejemplos de uso
}

export interface DynamicEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  parameters: Record<string, {
    type: 'string' | 'number' | 'boolean';
    required: boolean;
    description: string;
  }>;
  responseFormat?: string;
}

export class DynamicAPIManager {
  private registeredAPIs: Map<string, DynamicAPIConfig> = new Map();

  // Admin registra una nueva API
  async registerAPI(config: DynamicAPIConfig): Promise<void> {
    // Validar configuración
    this.validateAPIConfig(config);
    
    // Guardar en configuración persistente
    this.registeredAPIs.set(config.id, config);
    
    // Generar tool dinámico para el agente
    await this.generateToolFromAPI(config);
    
    // Notificar al superadmin vía Telegram
    await this.notifySuperAdmin(
      `API "${config.name}" registrada correctamente`
    );
  }

  // Generar tool que el agente puede usar
  private async generateToolFromAPI(
    api: DynamicAPIConfig
  ): Promise<void> {
    // Crear tool dinámico basado en la configuración
    const tool = {
      name: `api_${api.id}`,
      description: `${api.description}. Objetivo: ${api.purpose}`,
      parameters: this.buildParametersFromEndpoints(api.endpoints),
      handler: async (params: any) => {
        // Ejecutar llamada a la API real
        return await this.executeAPICall(api, params);
      }
    };

    // Registrar tool en el sistema
    await toolRegistry.register(tool);
  }

  // Ejecutar llamada a API externa
  private async executeAPICall(
    api: DynamicAPIConfig,
    params: any
  ): Promise<any> {
    const endpoint = this.selectEndpoint(api.endpoints, params);
    
    const response = await fetch(`${api.baseUrl}${endpoint.path}`, {
      method: endpoint.method,
      headers: this.buildAuthHeaders(api.authType, api.authCredentials),
      body: endpoint.method !== 'GET' ? JSON.stringify(params) : undefined
    });

    return await response.json();
  }
}
```

**Archivo**: `src/enterprise/google-integrations.ts` (NUEVO)

```typescript
// Mantener integraciones existentes de Google
export class GoogleIntegrations {
  // Google Calendar - ya existe, mantener
  async listCalendarEvents(calendarId: string) {
    // Usar autorización OAuth existente
    // ...
  }

  // Google Drive - ya existe, mantener
  async listDriveFiles(folderId?: string) {
    // Usar autorización OAuth existente
    // ...
  }

  // Registrar como APIs dinámicas para consistencia
  async registerGoogleAPIs(manager: DynamicAPIManager) {
    // Registrar Calendar como API dinámica
    await manager.registerAPI({
      id: 'google_calendar',
      name: 'Google Calendar',
      description: 'Gestionar eventos de calendario',
      baseUrl: 'https://www.googleapis.com/calendar/v3',
      authType: 'oauth',
      purpose: 'Agendar y consultar citas',
      endpoints: [
        // ... endpoints de Calendar
      ]
    });

    // Similar para Drive
  }
}
```

**Directorio**: `extensions/enterprise-api/` (NUEVO - Simplificado)

```
extensions/enterprise-api/
├── package.json
├── src/
│   ├── index.ts                    # Entry point
│   ├── dynamic-api-manager.ts      # Manager principal
│   ├── google-integrations.ts      # Google Calendar/Drive
│   └── config/
│       └── api-configs.json        # APIs configuradas por admin
└── README.md
```

#### 5.2 Tools Empresariales

**Archivo**: `extensions/enterprise-api/src/tools/stock-check-tool.ts`

Tool para consultar stock:
```typescript
export const stockCheckTool = {
  name: 'check_stock',
  description: 'Consultar disponibilidad de productos en inventario',
  parameters: {
    product_id: { type: 'string', required: true },
    location: { type: 'string', required: false }
  },
  handler: async (params) => {
    // Llamada a API de stock
    // Retornar disponibilidad, precio, ubicación
  }
};
```

**Archivo**: extensions/enterprise-api/src/tools/order-create-tool.ts`

Tool para crear pedidos:
```typescript
export const orderCreateTool = {
  name: 'create_order',
  description: 'Crear nuevo pedido para un cliente',
  parameters: {
    customer_id: { type: 'string', required: true },
    items: { type: 'array', required: true },
    shipping_address: { type: 'string', required: true }
  },
  requiresRootAuth: true, // Requiere aprobación vía Telegram
  handler: async (params) => {
    // Validar items y precios
    // Crear pedido en sistema
    // Retornar número de orden
  }
};
```

**Archivo**: `extensions/enterprise-api/src/tools/appointment-book-tool.ts`

Tool para agendar citas:
```typescript
export const appointmentBookTool = {
  name: 'book_appointment',
  description: 'Agendar cita con cliente',
  parameters: {
    customer_name: { type: 'string', required: true },
    date: { type: 'string', required: true },
    time: { type: 'string', required: true },
    service_type: { type: 'string', required: true }
  },
  handler: async (params) => {
    // Verificar disponibilidad
    // Crear cita en calendario
    // Enviar confirmación
  }
};
```

#### 5.3 Configuración

**Archivo**: Modificar `~/.openclaw/openclaw.json`

Agregar sección de configuración empresarial:
```json
{
  "enterprise": {
    "stock": {
      "apiUrl": "https://api.tu-sistema-stock.com",
      "apiKey": "${STOCK_API_KEY}",
      "enabled": true
    },
    "orders": {
      "apiUrl": "https://api.tu-e-commerce.com",
      "apiKey": "${ORDERS_API_KEY}",
      "enabled": true,
      "requiresRootAuth": true
    },
    "appointments": {
      "apiUrl": "https://api.tu-calendario.com",
      "apiKey": "${APPOINTMENTS_API_KEY}",
      "enabled": true,
      "timezone": "America/Argentina/Buenos_Aires"
    }
  }
}
```

### 6. Sistema de Quotas y Monitoreo

#### 6.1 Tracking de Uso

**Archivo**: `src/infra/usage-tracker.ts` (NUEVO)

Implementar:
- Contabilización de mensajes por usuario/canal
- Contabilización de tokens consumidos
- Persistencia de métricas (SQLite o archivo JSON)
- Queries para analytics

**Archivo**: `src/web/admin/analytics.ts` (modificar existente)

Dashboard con:
- Usuarios activos por canal
- Mensajes procesados (total, por canal, por hora)
- Tokens consumidos
- Rate limits alcanzados
- Costos estimados por uso de APIs

### 7. Experiencia de Usuario Público

#### 7.1 Mensajes de Bienvenida

**Archivo**: Modificar `src/channels/plugins/*/monitor.ts`

Agregar mensaje de bienvenida automático para nuevos usuarios públicos:
- Explicar capacidades del bot
- Indicar limitaciones de uso
- Proporcionar comandos disponibles

#### 7.2 Manejo de Límites

**Archivo**: `src/routing/rate-limit-middleware.ts`

Mensajes informativos cuando se alcanza límite:
- "Has alcanzado tu límite de X mensajes por hora"
- "Podrás enviar más mensajes en X minutos"
- "Para uso ilimitado, contacta al administrador"

---

## Plan de Verificación

### Pruebas Automatizadas

#### 1. Tests de Rate Limiting

**Archivo**: `src/infra/rate-limiter.test.ts` (NUEVO)

```bash
pnpm test -- rate-limiter.test.ts
```

Verificar:
- Límites por usuario se aplican correctamente
- Reset de contadores después de ventana de tiempo
- Manejo de múltiples usuarios concurrentes

#### 2. Tests de Autorización Root

**Archivo**: `src/telegram/root-authorization.test.ts` (NUEVO)

```bash
pnpm test -- root-authorization.test.ts
```

Verificar:
- Solicitudes de autorización se envían a Telegram
- Aprobaciones/rechazos se procesan correctamente
- Timeouts funcionan según configuración

#### 3. Tests de Segregación de Canales

**Archivo**: `src/channels/roles.test.ts` (NUEVO)

```bash
pnpm test -- roles.test.ts
```

Verificar:
- Telegram identificado como canal owner
- Otros canales identificados como public
- Permisos aplicados según rol

#### 4. Tests de APIs Empresariales

**Archivo**: `extensions/enterprise-api/src/tools/*.test.ts` (NUEVOS)

```bash
cd extensions/enterprise-api && pnpm test
```

Verificar:
- Llamadas a APIs externas (con mocks)
- Manejo de errores de API
- Validación de parámetros

### Pruebas Manuales

#### 1. Flujo de Usuario Público (WhatsApp)

**Pasos**:
1. Desde un número de WhatsApp NO en allowlist, enviar mensaje al bot
2. Verificar que el bot responde (si está en modo público)
3. Enviar múltiples mensajes rápidamente
4. Verificar que aparece mensaje de rate limit después de X mensajes
5. Esperar ventana de tiempo y verificar que se puede volver a enviar

**Resultado esperado**: Rate limits funcionan, mensajes informativos aparecen

#### 2. Flujo de Administrador (Telegram)

**Pasos**:
1. Desde Telegram (admin), enviar comando `/config` o acceder al panel web
2. Realizar cambio de configuración (ej: ajustar rate limit)
3. Verificar que el cambio se aplica inmediatamente
4. Intentar operación que requiera autorización root
5. Verificar que llegue notificación a Telegram con botones aprobar/rechazar
6. Aprobar y verificar que operación se completa

**Resultado esperado**: Admin tiene acceso completo, autorizaciones root funcionan

#### 3. Flujo de Panel Web

**Pasos**:
1. Acceder a `http://localhost:18789/admin` (u otra ruta configurada)
2. Introducir credenciales de login
3. Navegar por dashboard y ver métricas
4. Editar configuración del bot
5. Verificar que cambios se guardan correctamente

**Resultado esperado**: Panel funcional, seguro, cambios persisten

#### 4. Flujo de APIs Empresariales

**Pasos**:
1. Desde canal público, consultar stock: "¿Hay disponibilidad del producto XYZ?"
2. Verificar que bot consulte API y responda con información
3. Intentar crear pedido: "Quiero ordenar 5 unidades de XYZ"
4. Verificar que llegue solicitud de autorización a Telegram
5. Aprobar y verificar que pedido se cree en sistema

**Resultado esperado**: APIs funcionan, operaciones críticas requieren autorización

### Testing en Entorno de Desarrollo

```bash
# 1. Construir proyecto
pnpm build

# 2. Ejecutar tests unitarios
pnpm test

# 3. Ejecutar tests e2e
pnpm test:e2e

# 4. Verificar configuración con doctor
pnpm openclaw doctor

# 5. Iniciar gateway en modo verbose
pnpm openclaw gateway --verbose --force

# 6. Verificar canales
pnpm openclaw channels status --probe
```

### Verificación de Seguridad

```bash
# Ejecutar auditoría de seguridad
pnpm openclaw security audit --deep

# Verificar que no hay secretos expuestos
detect-secrets scan --baseline .secrets.baseline

# Verificar políticas de canales
pnpm openclaw channels status --all
```

---

## Riesgos y Mitigaciones

### Riesgo 1: Abuse de Usuarios Públicos

**Mitigación**:
- Rate limiting estricto
- Monitoreo de patrones de uso sospechosos
- Capacidad de bloquear usuarios específicos
- Logs detallados de acciones

### Riesgo 2: Exposición de Panel Web

**Mitigación**:
- Autenticación robusta (password hashing, tokens seguros)
- HTTPS obligatorioconfiguración en producción
- Rate limiting en endpoints de login
- Auditoría de accesos al panel

### Riesgo 3: Fallo en Autorización Root

**Mitigación**:
- Timeout configurablede solicitudes
- Fallback a modo seguro (denegar por defecto)
- Logs de todas las autorizaciones
- Notificaciones de operaciones críticas

### Riesgo 4: Sobrecarga por Mensajes Masivos

**Mitigación**:
- Rate limiting agresivo
- Queue de mensajes con prioridad (admin > público)
- Capacidad de deshabilitar canales públicos temporalmente
- Alertas de uso anómalo

---

## Siguiente Pasos Recomendados

1. **Revisión de este plan**: El usuario debe confirmar decisiones de diseño críticas
2. **Prototipo de rate limiting**: Implementar y probar en entorno aislado
3. **Diseño de panel web**: Mockups o wireframes de UI antes de implementar
4. **Definición de APIs**: Documentar endpoints y contratos de APIs empresariales
5. **Configuración de entorno de pruebas**: VPS o entorno local con todos los canales
6. **Implementación incremental**: Por módulos para facilitar testing y rollback
