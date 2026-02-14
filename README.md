# Agento - Gateway de IA Empresarial

<p align="center">
  <strong>Asistente de IA Multi-Canal para Negocios</strong><br>
  <em>Automatizacion inteligente con control total de tus datos</em>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/Licencia-MIT-blue.svg?style=for-the-badge" alt="Licencia MIT"></a>
  <img src="https://img.shields.io/badge/version-2026.2.10-ff6b6b?style=for-the-badge" alt="Version">
</p>

---

## Que es Agento?

**Agento** es un fork de OpenClaw optimizado para **negocios y empresas**:

| Caracteristica | Descripcion |
|----------------|-------------|
| **Multi-WhatsApp** | Ventas, Soporte, Compras, VIP |
| **Doble Personalidad** | Ventas (publico) + Admin (privado) |
| **LLMs Chinos** | DeepSeek, Kimi, GLM, Qwen, MiniMax |
| **Wizard Unificado** | Un comando configura todo |
| **APIs Empresariales** | Integracion con CRM, ERP, Stock |

---

## Inicio Rapido

### Desde Codigo Fuente

```bash
# 1. Clonar e instalar
git clone https://github.com/rdfinanzas/openClawEmpresarial.git
cd openClawEmpresarial
pnpm install

# 2. Compilar
pnpm build

# 3. Configurar (wizard interactivo)
node agento.mjs onboard

# 4. Iniciar gateway
node agento.mjs gateway --port 18789
```

### Requisitos
- Node.js 22+
- pnpm 10.23.0
- Puerto 18789 disponible

---

## Arquitectura

```
    CANALES              GATEWAY              AGENTES
  ┌──────────┐         ┌─────────┐         ┌─────────┐
  │WhatsApp  │         │         │         │         │
  │Telegram  │◄───────►│WebSocket│◄───────►│   IA    │
  │Discord   │  :18789 │         │         │         │
  └──────────┘         └─────────┘         └─────────┘
                              │
                    ┌────────┴────────┐
                    ▼                 ▼
              ┌──────────┐      ┌──────────┐
              │  VENTAS  │      │  ADMIN   │
              │(Restringido)    │(Completo)│
              └──────────┘      └──────────┘
```

---

## Canales Soportados

| Canal | Uso |
|-------|-----|
| **WhatsApp** | Ventas, Soporte, Compras (multi-cuenta) |
| **Telegram** | Admin (obligatorio) |
| **Discord** | Comunidades |
| **Slack** | Equipos |
| **Signal** | Privacidad |
| **WebChat** | Control UI |

---

## LLMs Soportados

### Occidentales
- Anthropic Claude
- OpenAI GPT
- Google Gemini

### Chinos (Configuracion Automatica)
- **DeepSeek**: `deepseek/deepseek-chat`
- **Kimi**: `moonshot/kimi-k2.5`
- **GLM**: `zai/glm-4.7`
- **Qwen**: `qwen/qwen-2.5`
- **MiniMax**: `minimax/m2.1`

---

## Comandos Principales

```bash
# Configuracion
agento onboard                    # Wizard unificado
agento enterprise setup           # Config empresarial
agento doctor                     # Diagnostico

# Gateway
agento gateway --port 18789       # Iniciar
agento gateway run               # Modo foreground

# Canales
agento channels login whatsapp   # Conectar WhatsApp
agento channels status           # Ver estado
```

---

## Sistema de Doble Personalidad

### Ventas (Publico)
- Canales: WhatsApp, Discord
- Acceso limitado
- Sin comandos de sistema
- Escalamiento automatico a Admin

### Admin (Privado)
- Canales: Telegram, Control UI
- Acceso completo
- Recibe alertas de seguridad
- Puede intervenir conversaciones

---

## Configuracion

Ubicacion: `~/.openclaw/openclaw.json`

```json5
{
  gateway: { port: 18789, mode: "local" },

  channels: {
    whatsapp: {
      enabled: true,
      accounts: [
        { id: "ventas", role: "public" },
        { id: "compras", role: "purchasing" }
      ]
    },
    telegram: {
      enabled: true,
      botToken: "TU_TOKEN",
      role: "admin"
    }
  },

  enterprise: {
    businessPersonality: {
      sales: { name: "Ventas", tone: "professional" },
      admin: { name: "Admin" }
    }
  }
}
```

---

## Desarrollo

```bash
# Compilar
pnpm build

# Desarrollo con watch
pnpm dev

# Tests
pnpm test

# Linting
pnpm lint
```

---

## Creditos

| Rol | Nombre |
|-----|--------|
| **Proyecto Original** | [OpenClaw](https://github.com/openclaw/openclaw) |
| **Fork Empresarial** | @rdfinanzas (Hector) |
| **Asistencia Desarrollo** | Kimi AI |

---

## Licencia

MIT License - ver [LICENSE](LICENSE)

---

<p align="center">
  <strong>Agento - Automatizacion inteligente para tu negocio</strong>
</p>
