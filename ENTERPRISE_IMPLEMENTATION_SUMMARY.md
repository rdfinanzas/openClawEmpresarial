# Agento - Resumen de Implementación Empresarial

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
| **Versión** | 2026.2.10 |
| **Entry point** | `agento.mjs` |
| **Comando** | `agento` |

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
    bind: "loopback"
  },

  // Canales
  channels: {
    whatsapp: {
      enabled: true,
      accounts: [
        { id: "ventas", role: "public", phoneNumber: "+..." },
        { id: "compras", role: "purchasing" }
      ]
    },
    telegram: {
      enabled: true,
      botToken: "...",
      role: "admin"
    }
  },

  // Modelos
  models: {
    default: "deepseek/deepseek-chat",
    providers: { /* credenciales */ }
  },

  // Empresarial
  enterprise: {
    businessPersonality: {
      sales: {
        name: "Asistente de Ventas",
        tone: "professional",
        expertise: ["productos", "precios"],
        restrictions: ["No modificar precios", "Sin datos sensibles"]
      },
      admin: {
        name: "Asistente Admin",
        capabilities: ["Gestión completa"],
        escalationTriggers: ["urgente", "hablar con humano"]
      }
    },
    features: {
      dualPersonality: true,
      securityAlerts: true,
      autoEscalation: true
    }
  }
}
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

### Troubleshooting común
- **Gateway no inicia:** Puerto 18789 ocupado
- **WhatsApp no conecta:** Reescanear QR con `channels login`
- **Error __exportAll:** Ejecutar `pnpm build` de nuevo
- **Config inválida:** `agento doctor` para diagnóstico

---

## Requisitos de Producción

### Checklist de Seguridad

- [ ] **Gateway Authentication**
  - [ ] Token o password configurado
  - [ ] `requireLocalAuth: true` para máxima seguridad
  - [ ] No exponer el gateway a internet sin autenticación

- [ ] **Canales**
  - [ ] Telegram configurado como canal admin
  - [ ] Allowlist o pairing habilitado para DMs
  - [ ] Cuentas WhatsApp con roles apropiados

- [ ] **LLM**
  - [ ] API Keys configuradas en auth profiles (no en .env)
  - [ ] Modelo por defecto configurado
  - [ ] Fallbacks configurados si es necesario

- [ ] **Sistema**
  - [ ] Node.js 22+ instalado
  - [ ] Firewall configurado (solo puertos necesarios abiertos)
  - [ ] Logs centralizados
  - [ ] Monitoreo de salud configurado

### Configuración de Autenticación Recomendada

#### Desarrollo (localhost)
```json5
gateway: {
  auth: {
    mode: "token",
    token: "dev-token",
    requireLocalAuth: false  // Permite bypass en localhost
  }
}
```

#### Producción (acceso remoto)
```json5
gateway: {
  bind: "lan",  // o "tailscale"
  auth: {
    mode: "token",
    token: "${AGENTO_GATEWAY_TOKEN}",  // Desde variable de entorno
    requireLocalAuth: true  // Siempre requiere auth
  }
}
```

### Puertos Utilizados

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

# Ejecutar con docker-compose
docker-compose up -d

# Ver logs
docker-compose logs -f
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

## Troubleshooting Común

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

---

*Última actualización: 2026-02-14*
