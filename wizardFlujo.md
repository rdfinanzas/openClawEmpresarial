# OpenClaw - Flujo Completo del Wizard de Onboarding

## Visión General

Este documento describe el flujo completo del wizard de configuración de OpenClaw, diseñado específicamente para **empresas** que necesitan:

- **Atender clientes** por WhatsApp (VENTAS, SOPORTE)
- **Administrar** el sistema por Telegram (ADMIN, MANAGERS)
- **Recibir notificaciones** en canales de soporte (Discord, Slack)

---

## Diagrama de Flujo General

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        WIZARD DE ONBOARDING COMPLETO                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  FASE 0  ──►  ENCABEZADO Y ADVERTENCIA DE SEGURIDAD                         │
│  FASE 1  ──►  DETECTAR CONFIGURACIÓN EXISTENTE                              │
│  FASE 2  ──►  SELECCIÓN DE MODO (QuickStart / Avanzado)                     │
│  FASE 3  ──►  CONFIGURACIÓN DEL GATEWAY                                     │
│  FASE 4  ──►  CONFIGURACIÓN DEL MODELO IA                                   │
│  ═══════════════════════════════════════════════════════════════            │
│  FASE 5  ──►  CONFIGURACIÓN EMPRESARIAL (ver detalle abajo)                 │
│  ═══════════════════════════════════════════════════════════════            │
│  FASE 6  ──►  CANALES DE SOPORTE (Discord, Slack)                           │
│  FASE 7  ──►  SKILLS RECOMENDADAS                                           │
│  FASE 8  ──►  HOOKS INTERNOS                                                │
│  FASE 9  ──►  FINALIZACIÓN (servicio gateway, health check, TUI)            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## FASE 0: Encabezado y Seguridad

### Propósito
Informar al usuario sobre los riesgos de ejecutar un agente de IA con capacidades de herramientas.

### Pasos
1. Mostrar header del wizard
2. Mostrar advertencia de seguridad:
   - OpenClaw está en beta
   - El bot puede leer archivos y ejecutar acciones
   - Un prompt malicioso puede engañarlo
3. Usuario debe aceptar el riesgo para continuar

### Código de Referencia
```typescript
// src/wizard/onboarding.ts - requireRiskAcknowledgement()
```

---

## FASE 1: Detectar Configuración Existente

### Propósito
Manejar configuraciones previas de forma inteligente.

### Pasos
1. Leer archivo de configuración (`~/.openclaw/openclaw.json`)
2. Si existe y es válida:
   - Mostrar resumen de configuración actual
   - Preguntar qué hacer:
     - **Usar valores existentes** (completar lo que falte)
     - **Revisar y modificar cada sección**
     - **Reiniciar todo**
3. Si elige reiniciar:
   - Preguntar alcance: solo config / config+creds+sesiones / completo
4. Si es inválida:
   - Mostrar errores
   - Sugerir ejecutar `openclaw doctor`

### Comportamiento Inteligente
Si elige "Usar valores existentes", por cada sección posterior:
- Verificar si ya está configurada
- Preguntar: "Mantener (valor actual) o Modificar"
- Si elige mantener, saltar esa sección

---

## FASE 2: Selección de Modo

### Opciones
| Modo | Descripción |
|------|-------------|
| **QuickStart** | Configuración rápida con valores por defecto |
| **Avanzado** | Configurar cada opción manualmente |

### Diferencias
- QuickStart: saltea prompts de política DM, usa valores por defecto
- Avanzado: pregunta por cada opción del gateway

---

## FASE 3: Configuración del Gateway

### Elementos Configurados
| Elemento | QuickStart | Avanzado |
|----------|------------|----------|
| Puerto | 18789 | Pregunta |
| Bind | Loopback (127.0.0.1) | Pregunta |
| Autenticación | Token | Pregunta (Token/Password) |
| Tailscale | Desactivado | Pregunta |
| Workspace | `~/.openclaw/workspace` | Pregunta |

### Modo Local vs Remoto
- **Local**: El gateway corre en esta máquina
- **Remoto**: Solo configurar URL de un gateway existente

---

## FASE 4: Configuración del Modelo IA

### Pasos
1. Mostrar proveedores disponibles:
   - OpenAI, Anthropic, Google, xAI, Moonshot AI, etc.
2. Seleccionar proveedor
3. Configurar autenticación:
   - API Key
   - OAuth (según proveedor)
4. Seleccionar modelo específico
5. Validar configuración

### Si ya está configurado
Preguntar: "Mantener (modelo actual) o Modificar"

---

## FASE 5: Configuración Empresarial ⭐

Esta es la **fase principal** para empresas. Tiene varios sub-pasos:

### PASO 5.1: Datos de la Empresa

```
┌─────────────────────────────────────────┐
│  📋 DATOS DE LA EMPRESA                 │
├─────────────────────────────────────────┤
│  • Nombre de la empresa                 │
│  • Tipo de negocio:                     │
│    - Retail / Tienda                    │
│    - Servicios                          │
│    - Consultoría                        │
│    - Salud                              │
│    - Educación                          │
│    - Otro                               │
│  • Descripción breve                    │
└─────────────────────────────────────────┘
```

### PASO 5.2: ADMIN (Telegram) - Super Administrador

```
┌─────────────────────────────────────────┐
│  🔴 ADMINISTRADOR PRINCIPAL (Telegram)  │
├─────────────────────────────────────────┤
│  PERMISOS:                              │
│  ✅ Configurar canales y modelo         │
│  ✅ Instalar/desinstalar skills         │
│  ✅ Ver métricas y logs                 │
│  ✅ Reiniciar el sistema                │
│  ✅ Control total del agente            │
│                                         │
│  CONFIGURACIÓN:                         │
│  • Token del bot de Telegram            │
│  • @username o ID numérico del admin    │
│                                         │
│  POLÍTICA: dmPolicy = "allowlist"       │
│  (Solo usuarios autorizados)            │
└─────────────────────────────────────────┘
```

**Cómo obtener los datos:**
1. Crear bot con @BotFather → obtener token
2. Tu username de Telegram (ej: @tu_username)
   - El sistema lo resuelve automáticamente a ID numérico
   - O podés usar el ID numérico directamente (de @userinfobot)

### PASO 5.3: MANAGERS (Telegram) - Supervisores

```
┌─────────────────────────────────────────┐
│  🟡 MANAGERS / SUPERVISORES (Telegram)  │
├─────────────────────────────────────────┤
│  PERMISOS:                              │
│  ✅ Ver métricas del negocio            │
│  ✅ Supervisar conversaciones           │
│  ✅ Dar instrucciones al agente         │
│                                         │
│  SIN PERMISOS DE:                       │
│  ❌ Cambiar configuración               │
│  ❌ Instalar/desinstalar                │
│  ❌ Modificar el entorno                │
│                                         │
│  CONFIGURACIÓN:                         │
│  Para cada manager:                     │
│  • Nombre                               │
│  • @username o ID de Telegram           │
└─────────────────────────────────────────┘
```

**Nota:** El sistema resuelve automáticamente los @username a ID numérico usando la API de Telegram.

### PASO 5.4: VENTAS (WhatsApp) - Atención al Público

```
┌─────────────────────────────────────────┐
│  🟢 EQUIPO DE VENTAS (WhatsApp)         │
├─────────────────────────────────────────┤
│  CARACTERÍSTICAS:                       │
│  • Cada vendedor tiene su WhatsApp      │
│  • Clientes escriben LIBREMENTE         │
│  • Personalidad de ventas               │
│                                         │
│  CONFIGURACIÓN:                         │
│  ¿Cuántos vendedores?                   │
│  Para cada uno:                         │
│  • Nombre del vendedor                  │
│  • Número de WhatsApp (con +)           │
│                                         │
│  POLÍTICA: dmPolicy = "open"            │
│  allowFrom = ["*"]                      │
│  (Clientes pueden escribir sin auth)    │
└─────────────────────────────────────────┘
```

### PASO 5.5: OTROS ROLES (WhatsApp)

```
┌─────────────────────────────────────────┐
│  🔵 OTROS ROLES (WhatsApp)              │
├─────────────────────────────────────────┤
│  ROLES DISPONIBLES:                     │
│  • Compras → Gestión de proveedores     │
│  • Soporte Técnico → Post-venta         │
│  • Logística → Entregas                 │
│  • Otro → Personalizado                 │
│                                         │
│  CONFIGURACIÓN:                         │
│  Para cada rol:                         │
│  • Tipo de rol                          │
│  • Nombre de la persona                 │
│  • Número de WhatsApp                   │
│                                         │
│  POLÍTICA: dmPolicy = "open"            │
└─────────────────────────────────────────┘
```

### PASO 5.6: Resumen y Confirmación

```
┌─────────────────────────────────────────┐
│  📋 RESUMEN DE CONFIGURACIÓN            │
├─────────────────────────────────────────┤
│  🏢 Mi Empresa (retail)                 │
│     Venta de productos tech             │
│                                         │
│  🔴 ADMIN (Telegram):                   │
│     ID: 123456789                       │
│                                         │
│  🟡 MANAGERS (Telegram):                │
│     • Juan Pérez: 987654321             │
│                                         │
│  🟢 VENTAS (WhatsApp - open):           │
│     • María García: +549376...          │
│     • Pedro López: +549376...           │
│                                         │
│  🔵 OTROS ROLES (WhatsApp):             │
│     • compras: Carlos - +549376...      │
└─────────────────────────────────────────┘

¿Todo correcto? ¿Aplicar configuración?
```

### PASO 5.7: Vincular Cuentas WhatsApp (QR)

```
┌─────────────────────────────────────────┐
│  📱 VINCULAR CUENTAS DE WHATSAPP        │
├─────────────────────────────────────────┤
│  Para cada cuenta:                      │
│                                         │
│  1. Verificar si ya está vinculada      │
│     (existe creds.json)                 │
│                                         │
│  2. Si no está:                         │
│     ¿Vincular ahora?                    │
│     └── Mostrar QR para escanear        │
│     └── Esperar escaneo                 │
│     └── Confirmar éxito/error           │
│                                         │
│  Instrucciones para escanear:           │
│  1. Abrir WhatsApp en el teléfono       │
│  2. Configuración > Dispositivos        │
│  3. "Vincular un dispositivo"           │
│  4. Escanear el código QR               │
└─────────────────────────────────────────┘
```

---

## FASE 6: Canales de Soporte

### Propósito
Configurar canales para notificaciones del sistema (NO para comunicación con clientes).

### Opciones
| Canal | Uso |
|-------|-----|
| **Discord** | Alertas, logs de errores, notificaciones |
| **Slack** | Comunicación del equipo, métricas |
| **Email** | Reportes semanales, alertas críticas |

### Flujo
1. Preguntar si quiere configurar canales de soporte
2. Si sí, ejecutar setupChannels() para Discord/Slack

---

## FASE 7: Skills Recomendadas

### Skills para Empresas

| Skill | Estado | Uso |
|-------|--------|-----|
| **wacli** | ✅ Recomendada | Contactar clientes por WhatsApp |
| **weather** | ✅ Recomendada | Consulta de clima para coordinar citas |
| **summarize** | ✅ Recomendada | Resumir documentos rápidamente |
| **notion** | Opcional | CRM interno, documentación |
| **slack** | Opcional | Comunicación del equipo |
| **github** | Opcional | Soporte técnico (si hay dev team) |

### Flujo
1. Mostrar lista de skills recomendadas
2. Usuario selecciona cuáles instalar
3. Instalar automáticamente

---

## FASE 8: Hooks Internos

### Qué son los Hooks
Son "gatillos" automáticos que ejecutan acciones cuando ocurren ciertos eventos.

### Hooks Disponibles
| Hook | Función |
|------|---------|
| **boot-md** | Ejecuta instrucciones BOOT.md al iniciar |
| **session-memory** | Guarda contexto entre sesiones |
| **command-logger** | Registra todos los comandos ejecutados |

### Flujo
1. Mostrar explicación de hooks
2. Listar hooks disponibles
3. Usuario selecciona cuáles habilitar
4. Configurar en `config.hooks.internal.entries`

---

## FASE 9: Finalización

### Sub-pasos

#### 9.1: Systemd Linger (Linux)
Si está en Linux con systemd:
- Verificar si linger está habilitado
- Si no, habilitar para que el servicio no muera al cerrar sesión

#### 9.2: Instalar Servicio Gateway
```
¿Instalar servicio Gateway? (recomendado)

Opciones:
  - Node (estable, soportado)
  - Docker (si tiene Docker instalado)
  - PM2 (si tiene PM2 instalado)
```

Si ya está instalado:
```
Servicio Gateway ya instalado
├── Reiniciar
├── Reinstalar
└── Omitir
```

#### 9.3: Health Check
1. Verificar que el gateway esté accesible
2. Si falla, mostrar mensaje de ayuda con links a documentación

#### 9.4: Abrir Dashboard
1. Construir URL del dashboard con token
2. Preguntar si quiere abrir el dashboard
3. Abrir en navegador si es posible

#### 9.5: Mensaje Final
```
✅ Onboarding completo

📱 CANALES CONFIGURADOS:
   • Telegram: 2 usuario(s)
   • WhatsApp: 3 cuenta(s)

🚀 PRÓXIMOS PASOS:
   1. Iniciar gateway: openclaw gateway
   2. Panel admin: http://localhost:18789/admin
   3. Probar enviando un mensaje por WhatsApp

📚 DOCUMENTACIÓN:
   • Canales: https://docs.openclaw.ai/channels
   • Empresarial: https://docs.openclaw.ai/enterprise
```

---

## Políticas de Canal

### Resumen de Configuración

| Canal | dmPolicy | allowFrom | Efecto |
|-------|----------|-----------|--------|
| **Telegram** | `allowlist` | `[admin_id, manager_ids]` | Solo usuarios autorizados pueden acceder |
| **WhatsApp** | `open` | `["*"]` | **Cualquier cliente puede escribir libremente** |

### Código de Configuración Resultante

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "123456:ABC...",
      "dmPolicy": "allowlist",
      "allowFrom": ["123456789", "987654321"],
      "groupPolicy": "disabled"
    },
    "whatsapp": {
      "enabled": true,
      "dmPolicy": "open",
      "allowFrom": ["*"],
      "accounts": {
        "ventas_1": {
          "name": "María García",
          "phoneNumber": "+5493764279895",
          "role": "public",
          "purpose": "Atención al público - Ventas",
          "enabled": true,
          "dmPolicy": "open",
          "allowFrom": ["*"]
        }
      }
    }
  }
}
```

---

## Sistema de Personalidad Dual

### Concepto
El agente tiene dos personalidades según el canal:

| Personalidad | Canal | Comportamiento |
|--------------|-------|----------------|
| **VENTAS** | WhatsApp (público) | Amable, orientado a ventas, con restricciones |
| **ADMIN** | Telegram (privado) | Control total, métricas, configuración |

### Configuración de Personalidad

```typescript
interface EnterprisePersonality {
  businessName: string;
  businessType: 'retail' | 'services' | 'consulting' | 'healthcare' | 'education' | 'other';
  businessDescription: string;
  sales: {
    name: string;              // "Vendedor"
    tone: 'professional' | 'friendly' | 'casual' | 'luxury';
    expertise: string[];       // ["Consultar disponibilidad", ...]
    restrictions: string[];    // ["No dar info de costos internos", ...]
  };
  admin: {
    name: string;              // "Admin"
    capabilities: string[];    // ["Control total", ...]
    escalationTriggers: string[]; // ["Hablar con encargado", ...]
  };
}
```

### Sistema de Escalada
Cuando un cliente dice algo que dispara escalada:
1. El agente de VENTAS detecta el trigger
2. Envía mensaje al ADMIN por Telegram
3. Notifica al cliente que un supervisor lo contactará
4. El ADMIN puede tomar el control de la conversación

---

## Permisos por Rol

| Acción | ADMIN | MANAGER | VENTAS |
|--------|-------|---------|--------|
| Responder clientes | ✅ | ✅ | ✅ |
| Ver métricas | ✅ | ✅ | ❌ |
| Ver logs | ✅ | ✅ | ❌ |
| Cambiar personalidad | ✅ | ❌ | ❌ |
| Instalar skills | ✅ | ❌ | ❌ |
| Cambiar configuración | ✅ | ❌ | ❌ |
| Reiniciar gateway | ✅ | ❌ | ❌ |
| Acceder a archivos | ✅ | Limitado | ❌ |
| Ejecutar comandos | ✅ | ❌ | ❌ |

---

## Archivos Involucrados

| Archivo | Función |
|---------|---------|
| `src/wizard/onboarding.ts` | Wizard principal |
| `src/wizard/onboarding-enterprise.ts` | Sub-wizard empresarial |
| `src/wizard/onboarding.finalize.ts` | Finalización (servicio, health check) |
| `src/wizard/onboarding.gateway-config.ts` | Configuración del gateway |
| `src/commands/onboard-hooks.ts` | Configuración de hooks |
| `src/commands/onboard-skills.ts` | Instalación de skills |
| `src/commands/onboard-channels.ts` | Configuración de canales |
| `src/config/types.enterprise.ts` | Tipos de configuración empresarial |
| `src/config/types.whatsapp.ts` | Tipos de configuración WhatsApp |

---

## Comandos Útiles Post-Wizard

```bash
# Iniciar el gateway
openclaw gateway

# Ver estado del gateway
openclaw status

# Ver configuración
openclaw config get

# Modificar configuración
openclaw configure

# Agregar nuevo vendedor
openclaw configure --section enterprise

# Ver logs
openclaw logs --follow

# Health check
openclaw health

# Vincular WhatsApp adicional
openclaw channels login whatsapp --account ventas_2
```

---

## Flujo Simplificado (Vista Rápida)

```
INICIO
  │
  ├─► Advertencia de seguridad
  │
  ├─► ¿Config existente? ──► keep/modify/reset
  │
  ├─► Modo: QuickStart / Avanzado
  │
  ├─► Gateway: puerto, auth, workspace
  │
  ├─► Modelo IA: proveedor, API key
  │
  ╔══════════════════════════════════════╗
  ║  EMPRESARIAL                          ║
  ╠══════════════════════════════════════╣
  ║  1. Datos empresa                     ║
  ║  2. ADMIN (Telegram) ─── allowlist    ║
  ║  3. MANAGERS (Telegram) ─ allowlist   ║
  ║  4. VENTAS (WhatsApp) ── open         ║
  ║  5. OTROS (WhatsApp) ─── open         ║
  ║  6. Resumen → Confirmar               ║
  ║  7. Vincular WhatsApp (QR)            ║
  ╚══════════════════════════════════════╝
  │
  ├─► Canales soporte: Discord, Slack
  │
  ├─► Skills: wacli, weather, summarize
  │
  ├─► Hooks: boot-md, session-memory
  │
  ├─► Instalar servicio gateway
  │
  ├─► Health check
  │
  └─► Abrir dashboard ──► FIN
```

---

## Diferencia con el Wizard Original

| Aspecto | Original | Actual |
|---------|----------|--------|
| Idioma | Inglés | Español ✅ |
| Enterprise | ❌ No tiene | ✅ Integrado |
| Múltiples WhatsApp | ❌ | ✅ |
| Login QR automático | ❌ | ✅ |
| Personalidades VENTAS/ADMIN | ❌ | ✅ |
| Managers con permisos limitados | ❌ | ✅ |
| dmPolicy "open" para clientes | ❌ | ✅ |

---

*Documento generado para OpenClaw - Wizard de Onboarding Empresarial*
