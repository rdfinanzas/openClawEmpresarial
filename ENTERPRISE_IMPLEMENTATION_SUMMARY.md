# Agento - Documentación Unificada

## Identidad del Proyecto

**Agento** es un fork de OpenClaw optimizado para uso empresarial con:
- Sistema de doble personalidad (Ventas/Admin)
- Multi-cuenta WhatsApp empresarial
- Soporte para LLMs chinos (DeepSeek, Kimi, GLM, Qwen, MiniMax)
- Wizard unificado en español

| Aspecto | Valor |
|---------|-------|
| **Nombre** | Agento |
| **Base** | OpenClaw (fork) |
| **Versión** | 2026.2.14 |
| **Entry point** | `agento.mjs` |
| **Comando** | `agento` (con backwards compatibility para `openclaw`) |

---

## Novedades en esta Versión

### Seguridad Mejorada
- **`requireLocalAuth`**: Nuevo flag para requerir autenticación incluso desde localhost
- **Modo `none`**: Opción para deshabilitar autenticación (solo desarrollo)

### Infraestructura Docker
- **Dockerfile mejorado**: Health check automático, usuario no-root
- **docker-compose.yml**: Configuración completa para producción
- **health-check.sh**: Script de verificación de salud

### Compatibilidad
- Soporte para comandos `agento` y `openclaw` (backwards compatibility)

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                       AGENTO                                 │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐    ┌─────────────────┐    ┌──────────────┐
│   CANALES    │    │     GATEWAY     │    │   AGENTES    │
│  (WhatsApp,  │◄──►│   Puerto 18789  │◄──►│   (IA)       │
│   Telegram,  │    │   WebSocket     │    │              │
│   Discord)   │    │                 │    │              │
└──────────────┘    └─────────────────┘    └──────────────┘
        │                     │
        │            ┌────────┴────────┐
        ▼            ▼                 ▼
┌──────────────┐ ┌──────────┐   ┌──────────┐
│   VENTAS     │ │ Control  │   │  APIs    │
│  (Restringido│ │   UI     │   │Externas  │
│   Público)   │ │ (Web)    │   │          │
├──────────────┤ └──────────┘   └──────────┘
│    ADMIN     │
│  (Completo,  │
│   Privado)   │
└──────────────┘
```

---

## Estructura de Directorios Clave

```
src/
├── agents/           # Sistema de agentes y tools
│   ├── tools/        # Herramientas del agente
│   └── skills/       # Sistema de skills
├── channels/         # Integraciones de mensajería
│   ├── plugins/      # Acciones, normalización, outbound
│   └── web/          # WebChat
├── cli/              # Interfaz de línea de comandos
├── commands/         # Comandos CLI individuales
├── config/           # Schemas Zod de configuración
├── enterprise/       # Módulos empresariales (NUEVO)
│   ├── api-manager.ts
│   ├── api-executor.ts
│   ├── dynamic-api-manager.ts
│   └── tool-generator.ts
├── gateway/          # WebSocket server
├── wizard/           # Wizards de configuración
│   └── onboarding-unified.ts  # Wizard principal
└── web/              # Interfaz web

scripts/
├── run-node.mjs      # Ejecutor principal
├── fix-exportall.mjs # Fix para bug rolldown #8184
└── *.mjs             # Varios scripts de utilidad
```

---

## Canales Soportados

| Canal | Librería | Uso Principal |
|-------|----------|---------------|
| WhatsApp | Baileys Web | Ventas, Soporte, Compras |
| Telegram | grammY | Admin (obligatorio) |
| Discord | discord.js | Comunidades |
| Slack | Socket Mode | Equipos |
| Signal | signal-cli | Privacidad |
| iMessage | imsg CLI | iOS/macOS |
| WebChat | WebSocket | Control UI |

---

## LLMs Soportados

### Proveedores Occidentales
- Anthropic (Claude)
- OpenAI (GPT)
- Google (Gemini)

### Proveedores Chinos (Configuración Automática)
| Proveedor | Model ID |
|-----------|----------|
| DeepSeek | `deepseek/deepseek-chat` |
| Kimi/Moonshot | `moonshot/kimi-k2.5` |
| GLM (Z.AI) | `zai/glm-4.7` |
| Qwen | `qwen/qwen-2.5` |
| MiniMax | `minimax/m2.1` |

---

## Comandos CLI Principales

```bash
# Configuración inicial
agento onboard                    # Wizard unificado (7 pasos)

# Gateway
agento gateway --port 18789       # Iniciar gateway
agento gateway run               # Modo foreground

# Canales
agento channels login whatsapp   # Escanear QR
agento channels status           # Ver estado

# Empresarial
agento enterprise setup          # Configurar dual-personality
agento enterprise status         # Ver configuración
agento enterprise apis           # Gestión de APIs

# Diagnóstico
agento doctor                    # Verificar sistema
agento config validate           # Validar config
agento security audit            # Auditoría de seguridad
agento status --all              # Estado completo
agento logs --follow             # Logs en tiempo real
```

---

## Configuración

**Ubicación:** `~/.openclaw/openclaw.json` (JSON5)

### Estructura Principal

```json5
{
  // Gateway
  gateway: {
    port: 18789,
    mode: "local",
    bind: "lan",  // "loopback", "lan", o "tailscale"
    auth: {
      mode: "token",
      // Token desde variable de entorno
      requireLocalAuth: true  // Siempre requerir auth
    },
    trustedProxies: ["10.0.0.1"],  // IPs de reverse proxy
    controlUi: {
      enabled: true,
      allowInsecureAuth: false
    }
  },

  // Canales
  channels: {
    whatsapp: {
      enabled: true,
      accounts: {
        ventas: {
          phoneNumber: "+5491112345678",
          role: "public",
          purpose: "Atención al público"
        }
      }
    },
    telegram: {
      enabled: true,
      botToken: "${TELEGRAM_BOT_TOKEN}",
      dmPolicy: "pairing",
      allowFrom: ["123456789"]  // Tu user ID
    }
  },

  // Modelos
  agents: {
    defaults: {
      model: {
        primary: "deepseek/deepseek-chat",
        fallbacks: ["openai/gpt-4o"]
      }
    }
  },

  // Empresarial
  enterprise: {
    personality: {
      businessName: "Mi Empresa",
      businessType: "retail",
      businessDescription: "Descripción del negocio",
      sales: {
        name: "Ana",
        tone: "professional",
        expertise: ["productos", "precios", "stock"],
        restrictions: ["No modificar precios sin autorización"]
      },
      admin: {
        name: "Admin",
        capabilities: ["Gestión completa", "Reportes"],
        escalationTriggers: ["urgente", "hablar con humano"]
      }
    },
    features: {
      dualPersonality: true,
      securityAlerts: true,
      escalationEnabled: true
    }
  }
}
```

### Variables de Entorno (.env o systemd)

```bash
# Auth
AGENTO_GATEWAY_TOKEN=tu-token-seguro-de-64-caracteres-minimo

# LLM (mejor en auth profiles)
DEEPSEEK_API_KEY=sk-...

# Canales
TELEGRAM_BOT_TOKEN=123456:ABCDEF...

# Producción
NODE_ENV=production
```

---

## Sistema de Doble Personalidad

### Personalidad Ventas (Público)
- **Canales:** WhatsApp, Discord
- **Acceso:** Limitado (sin comandos de sistema)
- **Tools:** Solo consulta
- **Restricciones:** Sin modificar precios, sin datos sensibles

### Personalidad Admin (Privado)
- **Canales:** Telegram, Control UI
- **Acceso:** Completo
- **Tools:** Todas disponibles
- **Alertas:** Recibe notificaciones de seguridad

### Escalamiento Automático
Triggers que activan escalamiento de Ventas → Admin:
- "Hablar con un humano"
- "Urgente" / "Emergencia"
- Intentos de ingeniería social
- Consultas fuera de scope
- Solicitudes de credenciales

---

## Compilación y Desarrollo

### Requisitos
- Node.js 22+
- pnpm 10.23.0

### Comandos

```bash
# Instalar dependencias
pnpm install

# Compilar
pnpm build

# Desarrollo
pnpm dev

# Ejecutar
node agento.mjs

# Tests
pnpm test
```

### Bug Conocido (Workaround)
El bundler rolldown tiene un bug (#8184) con `__exportAll`. El script `scripts/fix-exportall.mjs` se ejecuta automáticamente post-build como workaround.

---

## Checklist de Producción

### Seguridad del Gateway

- [ ] **Autenticación configurada**
  - Token o password establecido en `gateway.auth.token` o `gateway.auth.password`
  - Token generado de forma segura (mínimo 32 caracteres aleatorios)
  - Token almacenado en variable de entorno, no en código

- [ ] **Modo de autenticación localhost**
  - `gateway.auth.requireLocalAuth: true` para máxima seguridad
  - O `false` solo si el gateway nunca se expone fuera del host
  - **IMPORTANTE**: Con `requireLocalAuth: true`, el Control UI (`/chat`) requiere autenticación
  - Acceder con token: `http://localhost:18789/chat?session=main&token=TU_TOKEN`

- [ ] **Binding de red**
  - `gateway.bind: "loopback"` si solo se accede localmente
  - `gateway.bind: "lan"` para acceso desde red local
  - `gateway.bind: "tailscale"` para acceso remoto seguro
  - Nunca exponer directamente a internet sin reverse proxy

- [ ] **Reverse proxy** (si aplica)
  - Configurado con HTTPS (nginx/traefik/caddy)
  - `gateway.trustedProxies` configurado con IPs del proxy
  - Headers de forwarding correctamente configurados

### Canales

- [ ] **Telegram (Admin)**
  - Bot token configurado y verificado
  - User ID del admin en `allowFrom`
  - Política de DMs configurada (pairing recomendado)

- [ ] **WhatsApp**
  - Cuentas configuradas con roles apropiados
  - Sesiones activas verificadas
  - Números de teléfono correctos

- [ ] **Otros canales**
  - Solo canales necesarios habilitados
  - Credenciales verificadas

### LLM y Proveedores

- [ ] **API Keys**
  - Almacenadas en auth profiles (`~/.agento/auth-profiles/`)
  - NO en `.env` ni en `agento.json`
  - Mínimo un proveedor configurado y verificado

- [ ] **Modelo por defecto**
  - Configurado en `agents.defaults.model`
  - Fallbacks configurados si es necesario

- [ ] **Rate limits**
  - Consciente de los límites del proveedor
  - Monitoreo de uso configurado

### Sistema

- [ ] **Node.js**
  - Versión 22+ instalada
  - Memoria suficiente para el modelo usado

- [ ] **Firewall**
  - Solo puertos necesarios abiertos (18789, 18793 si se usa Canvas)
  - Reglas de entrada/salida documentadas

- [ ] **Logs**
  - Logs centralizados configurados
  - Rotación de logs activa
  - Nivel de log apropiado (warn/error en producción)

- [ ] **Monitoreo**
  - Health check endpoint accesible
  - Alertas configuradas para caídas
  - Métricas de rendimiento monitoreadas

- [ ] **Backups**
  - Configuración respaldada (`~/.agento/`)
  - Sesiones respaldadas si es crítico
  - Procedimiento de restore probado

### Docker (si aplica)

- [ ] **Contenedor**
  - Imagen construida correctamente
  - Health check pasando
  - Usuario no-root configurado

- [ ] **Volúmenes**
  - Configuración persistente montada
  - Workspace persistente montado

- [ ] **Red**
  - Puertos expuestos correctamente
  - Variables de entorno configuradas

---

## Verificaciones de Seguridad

### Autenticación y Autorización

```bash
# Verificar que localhost requiere auth (si requireLocalAuth=true)
curl http://localhost:18789/api/health
# Debe retornar 401 Unauthorized

# Verificar que el token funciona
curl -H "Authorization: Bearer TU_TOKEN" http://localhost:18789/api/health
# Debe retornar 200 OK
```

### Canales

```bash
# Verificar estado de canales
agento channels status --probe

# Verificar que el bot de Telegram responde
# Enviar mensaje al bot y verificar respuesta
```

### Gateway

```bash
# Verificar que el gateway está corriendo
agento gateway status

# Verificar puertos
lsof -i :18789
lsof -i :18793
```

---

## Puertos Utilizados

| Puerto | Servicio | Notas |
|--------|----------|-------|
| 18789 | Gateway WS + HTTP | Principal |
| 18793 | Canvas Host | Archivos estáticos |

---

## Guía de Despliegue

### Opción 1: Docker (Recomendado)

```bash
# Construir imagen
docker build -t agento:latest .

# O usar docker-compose
docker-compose build

# Crear archivo .env con las variables necesarias
cp .env.example .env
# Editar .env con tus valores

# Iniciar gateway
docker-compose up -d agento-gateway

# Ver logs
docker-compose logs -f agento-gateway

# Detener
docker-compose down
```

### Script de Health Check

```bash
# Verificación básica
./scripts/health-check.sh

# Con token de autenticación
./scripts/health-check.sh --token TU_TOKEN

# Output en formato JSON
./scripts/health-check.sh --json

# Verbose
./scripts/health-check.sh --verbose

# Host y puerto personalizados
./scripts/health-check.sh --host 192.168.1.100 --port 18789
```

### Opción 2: systemd (Linux)

```bash
# Crear servicio
sudo nano /etc/systemd/system/agento.service

# Contenido:
[Unit]
Description=Agento Gateway
After=network.target

[Service]
Type=simple
User=agento
WorkingDirectory=/opt/agento
ExecStart=/usr/bin/node agento.mjs gateway
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target

# Habilitar
sudo systemctl enable agento
sudo systemctl start agento
```

### Opción 3: launchd (macOS)

```bash
# Crear plist
~/Library/LaunchAgents/com.agento.gateway.plist
```

---

## Diferencias con OpenClaw Original

| Aspecto | OpenClaw | Agento |
|---------|----------|--------|
| Nombre | openclaw | agento |
| Enfoque | Personal | Empresarial |
| Personalidades | Una | Dual (Ventas/Admin) |
| WhatsApp | Una cuenta | Multi-cuenta |
| LLMs chinos | Manual | Configuración automática |
| Idioma wizard | Inglés | Español |
| Módulo enterprise | No | Sí |

### Archivos Nuevos
- `src/enterprise/` - Gestión de APIs y tools dinámicos
- `src/wizard/onboarding-unified.ts` - Wizard unificado
- `src/config/zod-schema.enterprise.ts` - Schema empresarial
- `scripts/fix-exportall.mjs` - Workaround rolldown
- `scripts/health-check.sh` - Script de verificación de salud

### Archivos Modificados
- `src/cli/cli-name.ts` - Cambio a "agento"
- `src/cli/banner.ts` - Branding actualizado
- `package.json` - Entry point y nombre

---

## Notas de Mantenimiento

### Al actualizar desde upstream
1. Revisar cambios en `src/agents/` y `src/channels/`
2. Merge cuidadoso en `src/config/zod-schema.ts`
3. Verificar que `scripts/fix-exportall.mjs` siga funcionando
4. Probar wizard con `agento onboard`

---

## Troubleshooting

### Gateway no inicia
- **Puerto ocupado:** Verificar con `lsof -i :18789`
- **Config inválida:** Ejecutar `agento doctor`
- **Permisos:** Verificar permisos de `~/.agento`

### Comandos del bot fallan
- **CLI no en PATH:** Verificar que `agento` esté accesible
- **Permisos:** Verificar permisos de ejecución
- **Logs:** Revisar logs del gateway para errores

### WhatsApp no conecta
- **QR expirado:** Reescanear con `agento channels login whatsapp`
- **Sesión inválida:** Eliminar sesión y reautenticar
- **Rate limiting:** Esperar si hubo muchos intentos

### Errores de autenticación
- **Token inválido:** Verificar `gateway.auth.token`
- **requireLocalAuth:** Si está activo, asegurar que el token se envía
- **Tailscale:** Verificar configuración de allowTailscale

### Error __exportAll
- Ejecutar `pnpm build` de nuevo
- Verificar que `scripts/fix-exportall.mjs` se ejecuta correctamente

---

## Contacto y Soporte

- Documentación: https://docs.agento.ai
- Issues: https://github.com/agent-oh/agento/issues
- Discord: https://discord.gg/agento

---

*Última actualización: 2026-02-14*
