# 🦞 OpenClaw — Asistente de IA Personal

<p align="center">
    <picture>
        <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/openclaw/openclaw/main/docs/assets/openclaw-logo-text-dark.png">
        <img src="https://raw.githubusercontent.com/openclaw/openclaw/main/docs/assets/openclaw-logo-text.png" alt="OpenClaw" width="500">
    </picture>
</p>

<p align="center">
  <strong>¡EXFOLIATE! ¡EXFOLIATE!</strong>
</p>

<p align="center">
  <a href="https://github.com/openclaw/openclaw/actions/workflows/ci.yml?branch=main"><img src="https://img.shields.io/github/actions/workflow/status/openclaw/openclaw/ci.yml?branch=main&style=for-the-badge" alt="Estado CI"></a>
  <a href="https://github.com/openclaw/openclaw/releases"><img src="https://img.shields.io/github/v/release/openclaw/openclaw?include_prereleases&style=for-the-badge" alt="GitHub release"></a>
  <a href="https://discord.gg/clawd"><img src="https://img.shields.io/discord/1456350064065904867?label=Discord&logo=discord&logoColor=white&color=5865F2&style=for-the-badge" alt="Discord"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="Licencia MIT"></a>
</p>

**OpenClaw** es un _asistente de IA personal_ que ejecutas en tus propios dispositivos.
Te responde en los canales que ya usas (WhatsApp, Telegram, Slack, Discord, Google Chat, Signal, iMessage, Microsoft Teams, WebChat), además de canales de extensión como BlueBubbles, Matrix, Zalo y Zalo Personal. Puede hablar y escuchar en macOS/iOS/Android, y renderizar un Canvas en vivo que tú controlas. El Gateway es solo el plano de control — el producto es el asistente.

Si quieres un asistente personal, de un solo usuario, que se sienta local, rápido y siempre activo, este es.

[Sitio web](https://openclaw.ai) · [Documentación](https://docs.openclaw.ai) · [DeepWiki](https://deepwiki.com/openclaw/openclaw) · [Primeros pasos](https://docs.openclaw.ai/start/getting-started) · [Actualizar](https://docs.openclaw.ai/install/updating) · [Showcase](https://docs.openclaw.ai/start/showcase) · [FAQ](https://docs.openclaw.ai/start/faq) · [Asistente](https://docs.openclaw.ai/start/wizard) · [Nix](https://github.com/openclaw/nix-openclaw) · [Docker](https://docs.openclaw.ai/install/docker) · [Discord](https://discord.gg/clawd)

Configuración preferida: ejecuta el asistente de configuración (`openclaw onboard`) en tu terminal.
El asistente te guía paso a paso a través de la configuración del gateway, workspace, canales y skills. El asistente CLI es la ruta recomendada y funciona en **macOS, Linux y Windows (vía WSL2; altamente recomendado)**.
Funciona con npm, pnpm o bun.
¿Nueva instalación? Empieza aquí: [Primeros pasos](https://docs.openclaw.ai/start/getting-started)

**Suscripciones (OAuth):**

- **[Anthropic](https://www.anthropic.com/)** (Claude Pro/Max)
- **[OpenAI](https://openai.com/)** (ChatGPT/Codex)

Nota sobre modelos: aunque se admite cualquier modelo, recomiendo fuertemente **Anthropic Pro/Max (100/200) + Opus 4.6** por su fortaleza en contextos largos y mejor resistencia a inyección de prompts. Ver [Onboarding](https://docs.openclaw.ai/start/onboarding).

## Modelos (selección + auth)

- Configuración de modelos + CLI: [Modelos](https://docs.openclaw.ai/concepts/models)
- Rotación de perfiles de auth (OAuth vs API keys) + fallbacks: [Failover de modelos](https://docs.openclaw.ai/concepts/model-failover)

## Instalación (recomendada)

Runtime: **Node ≥22**.

```bash
npm install -g openclaw@latest
# o: pnpm add -g openclaw@latest

openclaw onboard --install-daemon
```

El asistente instala el daemon del Gateway (servicio de usuario launchd/systemd) para que permanezca ejecutándose.

## Inicio rápido (TL;DR)

Runtime: **Node ≥22**.

Guía completa para principiantes (auth, emparejamiento, canales): [Primeros pasos](https://docs.openclaw.ai/start/getting-started)

```bash
openclaw onboard --install-daemon

openclaw gateway --port 18789 --verbose

# Enviar un mensaje
openclaw message send --to +1234567890 --message "Hola desde OpenClaw"

# Hablar con el asistente (opcionalmente entregar de vuelta a cualquier canal conectado: WhatsApp/Telegram/Slack/Discord/Google Chat/Signal/iMessage/BlueBubbles/Microsoft Teams/Matrix/Zalo/Zalo Personal/WebChat)
openclaw agent --message "Lista de verificación" --thinking high
```

¿Actualizando? [Guía de actualización](https://docs.openclaw.ai/install/updating) (y ejecuta `openclaw doctor`).

## Canales de desarrollo

- **stable**: releases etiquetados (`vYYYY.M.D` o `vYYYY.M.D-<patch>`), npm dist-tag `latest`.
- **beta**: prerelease tags (`vYYYY.M.D-beta.N`), npm dist-tag `beta` (la app de macOS puede faltar).
- **dev**: cabeza móvil de `main`, npm dist-tag `dev` (cuando se publica).

Cambiar canales (git + npm): `openclaw update --channel stable|beta|dev`.
Detalles: [Canales de desarrollo](https://docs.openclaw.ai/install/development-channels).

## Desde el código fuente (desarrollo)

Prefiere `pnpm` para builds desde el código fuente. Bun es opcional para ejecutar TypeScript directamente.

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw

pnpm install
pnpm ui:build # auto-instala dependencias UI en la primera ejecución
pnpm build

pnpm openclaw onboard --install-daemon

# Bucle de desarrollo (auto-recarga en cambios TS)
pnpm gateway:watch
```

Nota: `pnpm openclaw ...` ejecuta TypeScript directamente (vía `tsx`). `pnpm build` produce `dist/` para ejecutar vía Node / el binario empaquetado `openclaw`.

## Valores por defecto de seguridad (acceso DM)

OpenClaw se conecta a superficies de mensajería reales. Trata los DMs entrantes como **entrada no confiable**.

Guía completa de seguridad: [Seguridad](https://docs.openclaw.ai/gateway/security)

Comportamiento por defecto en Telegram/WhatsApp/Signal/iMessage/Microsoft Teams/Discord/Google Chat/Slack:

- **Emparejamiento DM** (`dmPolicy="pairing"` / `channels.discord.dm.policy="pairing"` / `channels.slack.dm.policy="pairing"`): los remitentes desconocidos reciben un código de emparejamiento corto y el bot no procesa su mensaje.
- Aprueba con: `openclaw pairing approve <channel> <code>` (entonces el remitente se agrega a un almacén local de lista blanca).
- Los DMs públicos entrantes requieren una inclusión explícita: establece `dmPolicy="open"` e incluye `"*"` en la lista blanca del canal (`allowFrom` / `channels.discord.dm.allowFrom` / `channels.slack.dm.allowFrom`).

Ejecuta `openclaw doctor` para detectar políticas DM riesgosas o mal configuradas.

## Destacados

- **[Gateway local-first](https://docs.openclaw.ai/gateway)** — plano de control único para sesiones, canales, herramientas y eventos.
- **[Bandeja de entrada multi-canal](https://docs.openclaw.ai/channels)** — WhatsApp, Telegram, Slack, Discord, Google Chat, Signal, BlueBubbles (iMessage), iMessage (legacy), Microsoft Teams, Matrix, Zalo, Zalo Personal, WebChat, macOS, iOS/Android.
- **[Enrutamiento multi-agente](https://docs.openclaw.ai/gateway/configuration)** — enruta canales/cuentas/pares entrantes a agentes aislados (workspaces + sesiones por agente).
- **[Voice Wake](https://docs.openclaw.ai/nodes/voicewake) + [Talk Mode](https://docs.openclaw.ai/nodes/talk)** — voz siempre activa para macOS/iOS/Android con ElevenLabs.
- **[Canvas en vivo](https://docs.openclaw.ai/platforms/mac/canvas)** — espacio de trabajo visual impulsado por el agente con [A2UI](https://docs.openclaw.ai/platforms/mac/canvas#canvas-a2ui).
- **[Herramientas de primera clase](https://docs.openclaw.ai/tools)** — navegador, canvas, nodos, cron, sesiones y acciones de Discord/Slack.
- **[Apps complementarias](https://docs.openclaw.ai/platforms/macos)** — app de macOS en la barra de menú + [nodos](https://docs.openclaw.ai/nodes) iOS/Android.
- **[Onboarding](https://docs.openclaw.ai/start/wizard) + [skills](https://docs.openclaw.ai/tools/skills)** — configuración guiada por asistente con skills incluidas/gestionadas/de workspace.

## Historial de estrellas

[![Gráfico de historial de estrellas](https://api.star-history.com/svg?repos=openclaw/openclaw&type=date&legend=top-left)](https://www.star-history.com/#openclaw/openclaw&type=date&legend=top-left)

## Todo lo que hemos construido hasta ahora

### Plataforma core

- [Plano de control Gateway WS](https://docs.openclaw.ai/gateway) con sesiones, presencia, config, cron, webhooks, [Control UI](https://docs.openclaw.ai/web) y [Canvas host](https://docs.openclaw.ai/platforms/mac/canvas#canvas-a2ui).
- [Superficie CLI](https://docs.openclaw.ai/tools/agent-send): gateway, agent, send, [wizard](https://docs.openclaw.ai/start/wizard) y [doctor](https://docs.openclaw.ai/gateway/doctor).
- [Runtime de agente Pi](https://docs.openclaw.ai/concepts/agent) en modo RPC con streaming de herramientas y streaming de bloques.
- [Modelo de sesión](https://docs.openclaw.ai/concepts/session): `main` para chats directos, aislamiento de grupos, modos de activación, modos de cola, respuesta. Reglas de grupos: [Grupos](https://docs.openclaw.ai/concepts/groups).
- [Pipeline de medios](https://docs.openclaw.ai/nodes/images): imágenes/audio/video, hooks de transcripción, límites de tamaño, ciclo de vida de archivos temporales. Detalles de audio: [Audio](https://docs.openclaw.ai/nodes/audio).

### Canales

- [Canales](https://docs.openclaw.ai/channels): [WhatsApp](https://docs.openclaw.ai/channels/whatsapp) (Baileys), [Telegram](https://docs.openclaw.ai/channels/telegram) (grammY), [Slack](https://docs.openclaw.ai/channels/slack) (Bolt), [Discord](https://docs.openclaw.ai/channels/discord) (discord.js), [Google Chat](https://docs.openclaw.ai/channels/googlechat) (Chat API), [Signal](https://docs.openclaw.ai/channels/signal) (signal-cli), [BlueBubbles](https://docs.openclaw.ai/channels/bluebubbles) (iMessage, recomendado), [iMessage](https://docs.openclaw.ai/channels/imessage) (imsg legacy), [Microsoft Teams](https://docs.openclaw.ai/channels/msteams) (extensión), [Matrix](https://docs.openclaw.ai/channels/matrix) (extensión), [Zalo](https://docs.openclaw.ai/channels/zalo) (extensión), [Zalo Personal](https://docs.openclaw.ai/channels/zalouser) (extensión), [WebChat](https://docs.openclaw.ai/web/webchat).
- [Enrutamiento de grupos](https://docs.openclaw.ai/concepts/group-messages): mention gating, etiquetas de respuesta, fragmentación y enrutamiento por canal. Reglas de canales: [Canales](https://docs.openclaw.ai/channels).

### Apps + nodos

- [App de macOS](https://docs.openclaw.ai/platforms/macos): plano de control en la barra de menú, [Voice Wake](https://docs.openclaw.ai/nodes/voicewake)/PTT, overlay de [Talk Mode](https://docs.openclaw.ai/nodes/talk), [WebChat](https://docs.openclaw.ai/web/webchat), herramientas de debug, control de [gateway remoto](https://docs.openclaw.ai/gateway/remote).
- [Nodo iOS](https://docs.openclaw.ai/platforms/ios): [Canvas](https://docs.openclaw.ai/platforms/mac/canvas), [Voice Wake](https://docs.openclaw.ai/nodes/voicewake), [Talk Mode](https://docs.openclaw.ai/nodes/talk), cámara, grabación de pantalla, emparejamiento Bonjour.
- [Nodo Android](https://docs.openclaw.ai/platforms/android): [Canvas](https://docs.openclaw.ai/platforms/mac/canvas), [Talk Mode](https://docs.openclaw.ai/nodes/talk), cámara, grabación de pantalla, SMS opcional.
- [Modo nodo macOS](https://docs.openclaw.ai/nodes): system.run/notify + exposición de canvas/cámara.

### Herramientas + automatización

- [Control de navegador](https://docs.openclaw.ai/tools/browser): Chrome/Chromium dedicado de openclaw, snapshots, acciones, subidas, perfiles.
- [Canvas](https://docs.openclaw.ai/platforms/mac/canvas): push/reset de [A2UI](https://docs.openclaw.ai/platforms/mac/canvas#canvas-a2ui), eval, snapshot.
- [Nodos](https://docs.openclaw.ai/nodes): captura de cámara/clip, grabación de pantalla, [location.get](https://docs.openclaw.ai/nodes/location-command), notificaciones.
- [Cron + wakeups](https://docs.openclaw.ai/automation/cron-jobs); [webhooks](https://docs.openclaw.ai/automation/webhook); [Gmail Pub/Sub](https://docs.openclaw.ai/automation/gmail-pubsub).
- [Plataforma de skills](https://docs.openclaw.ai/tools/skills): skills incluidas, gestionadas y de workspace con install gating + UI.

### Runtime + seguridad

- [Enrutamiento de canales](https://docs.openclaw.ai/concepts/channel-routing), [política de reintentos](https://docs.openclaw.ai/concepts/retry) y [streaming/fragmentación](https://docs.openclaw.ai/concepts/streaming).
- [Presencia](https://docs.openclaw.ai/concepts/presence), [indicadores de escritura](https://docs.openclaw.ai/concepts/typing-indicators) y [seguimiento de uso](https://docs.openclaw.ai/concepts/usage-tracking).
- [Modelos](https://docs.openclaw.ai/concepts/models), [failover de modelos](https://docs.openclaw.ai/concepts/model-failover) y [poda de sesiones](https://docs.openclaw.ai/concepts/session-pruning).
- [Seguridad](https://docs.openclaw.ai/gateway/security) y [solución de problemas](https://docs.openclaw.ai/channels/troubleshooting).

### Ops + empaquetado

- [Control UI](https://docs.openclaw.ai/web) + [WebChat](https://docs.openclaw.ai/web/webchat) servido directamente desde el Gateway.
- [Tailscale Serve/Funnel](https://docs.openclaw.ai/gateway/tailscale) o [túneles SSH](https://docs.openclaw.ai/gateway/remote) con auth de token/password.
- [Modo Nix](https://docs.openclaw.ai/install/nix) para config declarativa; instalaciones basadas en [Docker](https://docs.openclaw.ai/install/docker).
- [Doctor](https://docs.openclaw.ai/gateway/doctor) migraciones, [logging](https://docs.openclaw.ai/logging).

## Cómo funciona (resumen)

```
WhatsApp / Telegram / Slack / Discord / Google Chat / Signal / iMessage / BlueBubbles / Microsoft Teams / Matrix / Zalo / Zalo Personal / WebChat
               │
               ▼
┌───────────────────────────────┐
│            Gateway            │
│       (plano de control)      │
│     ws://127.0.0.1:18789      │
└──────────────┬────────────────┘
               │
               ├─ Agente Pi (RPC)
               ├─ CLI (openclaw …)
               ├─ WebChat UI
               ├─ App macOS
               └─ Nodos iOS / Android
```

## Subsistemas clave

- **[Red WebSocket del Gateway](https://docs.openclaw.ai/concepts/architecture)** — plano de control WS único para clientes, herramientas y eventos (más ops: [Runbook del Gateway](https://docs.openclaw.ai/gateway)).
- **[Exposición Tailscale](https://docs.openclaw.ai/gateway/tailscale)** — Serve/Funnel para el dashboard del Gateway + WS (acceso remoto: [Remoto](https://docs.openclaw.ai/gateway/remote)).
- **[Control de navegador](https://docs.openclaw.ai/tools/browser)** — Chrome/Chromium gestionado por openclaw con control CDP.
- **[Canvas + A2UI](https://docs.openclaw.ai/platforms/mac/canvas)** — espacio de trabajo visual impulsado por el agente (host A2UI: [Canvas/A2UI](https://docs.openclaw.ai/platforms/mac/canvas#canvas-a2ui)).
- **[Voice Wake](https://docs.openclaw.ai/nodes/voicewake) + [Talk Mode](https://docs.openclaw.ai/nodes/talk)** — voz siempre activa y conversación continua.
- **[Nodos](https://docs.openclaw.ai/nodes)** — Canvas, captura de cámara/clip, grabación de pantalla, `location.get`, notificaciones, más `system.run`/`system.notify` solo para macOS.

## Acceso Tailscale (dashboard del Gateway)

OpenClaw puede auto-configurar Tailscale **Serve** (solo tailnet) o **Funnel** (público) mientras el Gateway permanece vinculado a loopback. Configura `gateway.tailscale.mode`:

- `off`: sin automatización de Tailscale (por defecto).
- `serve`: HTTPS solo tailnet vía `tailscale serve` (usa headers de identidad de Tailscale por defecto).
- `funnel`: HTTPS público vía `tailscale funnel` (requiere auth de contraseña compartida).

Notas:

- `gateway.bind` debe permanecer `loopback` cuando Serve/Funnel está habilitado (OpenClaw lo impone).
- Serve puede ser forzado a requerir una contraseña estableciendo `gateway.auth.mode: "password"` o `gateway.auth.allowTailscale: false`.
- Funnel se niega a iniciar a menos que `gateway.auth.mode: "password"` esté configurado.
- Opcional: `gateway.tailscale.resetOnExit` para deshacer Serve/Funnel al apagar.

Detalles: [Guía de Tailscale](https://docs.openclaw.ai/gateway/tailscale) · [Superficies web](https://docs.openclaw.ai/web)

## Gateway remoto (Linux es genial)

Está perfectamente bien ejecutar el Gateway en una pequeña instancia Linux. Los clientes (app de macOS, CLI, WebChat) pueden conectarse a través de **Tailscale Serve/Funnel** o **túneles SSH**, y aún puedes emparejar nodos de dispositivos (macOS/iOS/Android) para ejecutar acciones locales del dispositivo cuando sea necesario.

- El **host del Gateway** ejecuta la herramienta exec y las conexiones de canal por defecto.
- Los **nodos de dispositivos** ejecutan acciones locales del dispositivo (`system.run`, cámara, grabación de pantalla, notificaciones) vía `node.invoke`.
  En resumen: exec se ejecuta donde vive el Gateway; las acciones del dispositivo se ejecutan donde vive el dispositivo.

Detalles: [Acceso remoto](https://docs.openclaw.ai/gateway/remote) · [Nodos](https://docs.openclaw.ai/nodes) · [Seguridad](https://docs.openclaw.ai/gateway/security)

## Permisos de macOS vía el protocolo del Gateway

La app de macOS puede ejecutarse en **modo nodo** y anuncia sus capacidades + mapa de permisos sobre el WebSocket del Gateway (`node.list` / `node.describe`). Los clientes pueden entonces ejecutar acciones locales vía `node.invoke`:

- `system.run` ejecuta un comando local y devuelve stdout/stderr/código de salida; establece `needsScreenRecording: true` para requerir permiso de grabación de pantalla (de lo contrario obtendrás `PERMISSION_MISSING`).
- `system.notify` publica una notificación de usuario y falla si las notificaciones están denegadas.
- `canvas.*`, `camera.*`, `screen.record` y `location.get` también se enrutan vía `node.invoke` y siguen el estado del permiso TCC.

Bash elevado (permisos del host) es separado de TCC de macOS:

- Usa `/elevated on|off` para alternar acceso elevado por sesión cuando está habilitado + en lista blanca.
- El Gateway persiste el interruptor por sesión vía `sessions.patch` (método WS) junto con `thinkingLevel`, `verboseLevel`, `model`, `sendPolicy` y `groupActivation`.

Detalles: [Nodos](https://docs.openclaw.ai/nodes) · [App de macOS](https://docs.openclaw.ai/platforms/macos) · [Protocolo del Gateway](https://docs.openclaw.ai/concepts/architecture)

## Agente a Agente (herramientas sessions_*)

- Úsalas para coordinar trabajo a través de sesiones sin saltar entre superficies de chat.
- `sessions_list` — descubre sesiones activas (agentes) y sus metadatos.
- `sessions_history` — obtiene logs de transcripción para una sesión.
- `sessions_send` — mensajea otra sesión; ping-pong de respuesta opcional + paso de anuncio (`REPLY_SKIP`, `ANNOUNCE_SKIP`).

Detalles: [Herramientas de sesión](https://docs.openclaw.ai/concepts/session-tool)

## Registro de skills (ClawHub)

ClawHub es un registro de skills mínimo. Con ClawHub habilitado, el agente puede buscar skills automáticamente y traer nuevas según sea necesario.

[ClawHub](https://clawhub.com)

## Comandos de chat

Envía estos en WhatsApp/Telegram/Slack/Google Chat/Microsoft Teams/WebChat (los comandos de grupo son solo para el propietario):

- `/status` — estado compacto de la sesión (modelo + tokens, costo cuando está disponible)
- `/new` o `/reset` — reinicia la sesión
- `/compact` — compacta el contexto de la sesión (resumen)
- `/think <level>` — off|minimal|low|medium|high|xhigh (solo modelos GPT-5.2 + Codex)
- `/verbose on|off`
- `/usage off|tokens|full` — pie de uso por respuesta
- `/restart` — reinicia el gateway (solo propietario en grupos)
- `/activation mention|always` — alternancia de activación de grupo (solo grupos)

## Apps (opcional)

El Gateway solo proporciona una gran experiencia. Todas las apps son opcionales y agregan características extra.

Si planeas construir/ejecutar apps complementarias, sigue los runbooks de plataforma a continuación.

### macOS (OpenClaw.app) (opcional)

- Control de la barra de menú para el Gateway y salud.
- Voice Wake + overlay de push-to-talk.
- WebChat + herramientas de debug.
- Control de gateway remoto sobre SSH.

Nota: builds firmadas requeridas para que los permisos de macOS persistan a través de rebuilds (ver `docs/mac/permissions.md`).

### Nodo iOS (opcional)

- Se empareja como un nodo vía el Bridge.
- Reenvío de trigger de voz + superficie de Canvas.
- Controlado vía `openclaw nodes …`.

Runbook: [Conexión iOS](https://docs.openclaw.ai/platforms/ios).

### Nodo Android (opcional)

- Se empareja vía el mismo Bridge + flujo de emparejamiento que iOS.
- Expone comandos de Canvas, Cámara y Captura de pantalla.
- Runbook: [Conexión Android](https://docs.openclaw.ai/platforms/android).

## Workspace del agente + skills

- Raíz del workspace: `~/.openclaw/workspace` (configurable vía `agents.defaults.workspace`).
- Archivos de prompt inyectados: `AGENTS.md`, `SOUL.md`, `TOOLS.md`.
- Skills: `~/.openclaw/workspace/skills/<skill>/SKILL.md`.

## Configuración

`~/.openclaw/openclaw.json` mínimo (modelo + defaults):

```json5
{
  agent: {
    model: "anthropic/claude-opus-4-6",
  },
}
```

[Referencia completa de configuración (todas las claves + ejemplos).](https://docs.openclaw.ai/gateway/configuration)

## Modelo de seguridad (importante)

- **Por defecto:** las herramientas se ejecutan en el host para la sesión **main**, así que el agente tiene acceso completo cuando eres solo tú.
- **Seguridad de grupo/canal:** establece `agents.defaults.sandbox.mode: "non-main"` para ejecutar **sesiones no-main** (grupos/canales) dentro de sandboxes Docker por sesión; bash entonces se ejecuta en Docker para esas sesiones.
- **Defaults del sandbox:** lista blanca `bash`, `process`, `read`, `write`, `edit`, `sessions_list`, `sessions_history`, `sessions_send`, `sessions_spawn`; lista negra `browser`, `canvas`, `nodes`, `cron`, `discord`, `gateway`.

Detalles: [Guía de seguridad](https://docs.openclaw.ai/gateway/security) · [Docker + sandboxing](https://docs.openclaw.ai/install/docker) · [Config de sandbox](https://docs.openclaw.ai/gateway/configuration)

### [WhatsApp](https://docs.openclaw.ai/channels/whatsapp)

- Vincula el dispositivo: `pnpm openclaw channels login` (almacena credenciales en `~/.openclaw/credentials`).
- Lista blanca de quién puede hablar con el asistente vía `channels.whatsapp.allowFrom`.
- Si `channels.whatsapp.groups` está configurado, se convierte en una lista blanca de grupos; incluye `"*"` para permitir todos.

### [Telegram](https://docs.openclaw.ai/channels/telegram)

- Establece `TELEGRAM_BOT_TOKEN` o `channels.telegram.botToken` (env gana).
- Opcional: establece `channels.telegram.groups` (con `channels.telegram.groups."*".requireMention`); cuando está configurado, es una lista blanca de grupos (incluye `"*"` para permitir todos). También `channels.telegram.allowFrom` o `channels.telegram.webhookUrl` + `channels.telegram.webhookSecret` según sea necesario.

```json5
{
  channels: {
    telegram: {
      botToken: "123456:ABCDEF",
    },
  },
}
```

### [Slack](https://docs.openclaw.ai/channels/slack)

- Establece `SLACK_BOT_TOKEN` + `SLACK_APP_TOKEN` (o `channels.slack.botToken` + `channels.slack.appToken`).

### [Discord](https://docs.openclaw.ai/channels/discord)

- Establece `DISCORD_BOT_TOKEN` o `channels.discord.token` (env gana).
- Opcional: establece `commands.native`, `commands.text` o `commands.useAccessGroups`, más `channels.discord.dm.allowFrom`, `channels.discord.guilds` o `channels.discord.mediaMaxMb` según sea necesario.

```json5
{
  channels: {
    discord: {
      token: "1234abcd",
    },
  },
}
```

### [Signal](https://docs.openclaw.ai/channels/signal)

- Requiere `signal-cli` y una sección de config `channels.signal`.

### [BlueBubbles (iMessage)](https://docs.openclaw.ai/channels/bluebubbles)

- **Integración de iMessage recomendada.**
- Configura `channels.bluebubbles.serverUrl` + `channels.bluebubbles.password` y un webhook (`channels.bluebubbles.webhookPath`).
- El servidor BlueBubbles se ejecuta en macOS; el Gateway puede ejecutarse en macOS o en cualquier otro lugar.

### [iMessage (legacy)](https://docs.openclaw.ai/channels/imessage)

- Integración legacy solo para macOS vía `imsg` (Messages debe tener sesión iniciada).
- Si `channels.imessage.groups` está configurado, se convierte en una lista blanca de grupos; incluye `"*"` para permitir todos.

### [Microsoft Teams](https://docs.openclaw.ai/channels/msteams)

- Configura una app de Teams + Bot Framework, luego agrega una sección de config `msteams`.
- Lista blanca de quién puede hablar vía `msteams.allowFrom`; acceso a grupos vía `msteams.groupAllowFrom` o `msteams.groupPolicy: "open"`.

### [WebChat](https://docs.openclaw.ai/web/webchat)

- Usa el WebSocket del Gateway; sin puerto/config de WebChat separado.

Control de navegador (opcional):

```json5
{
  browser: {
    enabled: true,
    color: "#FF4500",
  },
}
```

## Documentación

Usa estas cuando hayas pasado el flujo de onboarding y quieras la referencia más profunda.

- [Empieza con el índice de docs para navegación y "qué está dónde".](https://docs.openclaw.ai)
- [Lee el overview de arquitectura para el modelo de gateway + protocolo.](https://docs.openclaw.ai/concepts/architecture)
- [Usa la referencia completa de configuración cuando necesites cada clave y ejemplo.](https://docs.openclaw.ai/gateway/configuration)
- [Ejecuta el Gateway por el libro con el runbook operacional.](https://docs.openclaw.ai/gateway)
- [Aprende cómo funcionan las superficies Control UI/Web y cómo exponerlas de forma segura.](https://docs.openclaw.ai/web)
- [Entiende el acceso remoto sobre túneles SSH o tailnets.](https://docs.openclaw.ai/gateway/remote)
- [Sigue el flujo del asistente de onboarding para una configuración guiada.](https://docs.openclaw.ai/start/wizard)
- [Conecta triggers externos vía la superficie webhook.](https://docs.openclaw.ai/automation/webhook)
- [Configura triggers de Gmail Pub/Sub.](https://docs.openclaw.ai/automation/gmail-pubsub)
- [Aprende los detalles del complemento de macOS en la barra de menú.](https://docs.openclaw.ai/platforms/mac/menu-bar)
- [Guías de plataforma: Windows (WSL2)](https://docs.openclaw.ai/platforms/windows), [Linux](https://docs.openclaw.ai/platforms/linux), [macOS](https://docs.openclaw.ai/platforms/macos), [iOS](https://docs.openclaw.ai/platforms/ios), [Android](https://docs.openclaw.ai/platforms/android)
- [Depura fallas comunes con la guía de solución de problemas.](https://docs.openclaw.ai/channels/troubleshooting)
- [Revisa la guía de seguridad antes de exponer cualquier cosa.](https://docs.openclaw.ai/gateway/security)

## Documentación avanzada (descubrimiento + control)

- [Descubrimiento + transportes](https://docs.openclaw.ai/gateway/discovery)
- [Bonjour/mDNS](https://docs.openclaw.ai/gateway/bonjour)
- [Emparejamiento del Gateway](https://docs.openclaw.ai/gateway/pairing)
- [README del Gateway remoto](https://docs.openclaw.ai/gateway/remote-gateway-readme)
- [Control UI](https://docs.openclaw.ai/web/control-ui)
- [Dashboard](https://docs.openclaw.ai/web/dashboard)

## Operaciones y solución de problemas

- [Health checks](https://docs.openclaw.ai/gateway/health)
- [Bloqueo del Gateway](https://docs.openclaw.ai/gateway/gateway-lock)
- [Proceso en segundo plano](https://docs.openclaw.ai/gateway/background-process)
- [Solución de problemas del navegador (Linux)](https://docs.openclaw.ai/tools/browser-linux-troubleshooting)
- [Logging](https://docs.openclaw.ai/logging)

## Deep dives

- [Agent loop](https://docs.openclaw.ai/concepts/agent-loop)
- [Presencia](https://docs.openclaw.ai/concepts/presence)
- [Esquemas TypeBox](https://docs.openclaw.ai/concepts/typebox)
- [Adaptadores RPC](https://docs.openclaw.ai/reference/rpc)
- [Cola](https://docs.openclaw.ai/concepts/queue)

## Workspace y skills

- [Config de skills](https://docs.openclaw.ai/tools/skills-config)
- [AGENTS por defecto](https://docs.openclaw.ai/reference/AGENTS.default)
- [Plantillas: AGENTS](https://docs.openclaw.ai/reference/templates/AGENTS)
- [Plantillas: BOOTSTRAP](https://docs.openclaw.ai/reference/templates/BOOTSTRAP)
- [Plantillas: IDENTITY](https://docs.openclaw.ai/reference/templates/IDENTITY)
- [Plantillas: SOUL](https://docs.openclaw.ai/reference/templates/SOUL)
- [Plantillas: TOOLS](https://docs.openclaw.ai/reference/templates/TOOLS)
- [Plantillas: USER](https://docs.openclaw.ai/reference/templates/USER)

## Internos de plataforma

- [Setup de desarrollo macOS](https://docs.openclaw.ai/platforms/mac/dev-setup)
- [Barra de menú macOS](https://docs.openclaw.ai/platforms/mac/menu-bar)
- [Voice wake macOS](https://docs.openclaw.ai/platforms/mac/voicewake)
- [Nodo iOS](https://docs.openclaw.ai/platforms/ios)
- [Nodo Android](https://docs.openclaw.ai/platforms/android)
- [Windows (WSL2)](https://docs.openclaw.ai/platforms/windows)
- [App de Linux](https://docs.openclaw.ai/platforms/linux)

## Hooks de email (Gmail)

- [docs.openclaw.ai/gmail-pubsub](https://docs.openclaw.ai/automation/gmail-pubsub)

## Molty

OpenClaw fue construido para **Molty**, un asistente de IA langosta espacial. 🦞
por Peter Steinberger y la comunidad.

- [openclaw.ai](https://openclaw.ai)
- [soul.md](https://soul.md)
- [steipete.me](https://steipete.me)
- [@openclaw](https://x.com/openclaw)

## Comunidad

Ver [CONTRIBUTING.md](CONTRIBUTING.md) para pautas, maintainers y cómo enviar PRs.
¡PRs con vibe-coding/IA bienvenidos! 🤖

Agradecimientos especiales a [Mario Zechner](https://mariozechner.at/) por su apoyo y por
[pi-mono](https://github.com/badlogic/pi-mono).
Agradecimientos especiales a Adam Doppelt por lobster.bot.

---

*README en español actualizado el: 2026-02-13*
