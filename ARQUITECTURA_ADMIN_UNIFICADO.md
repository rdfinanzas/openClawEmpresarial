# OpenClaw Admin - Panel de Control Unificado

## 🎯 Propuesta: Unificar todo en `/admin`

**Problema actual:**
- UI (`/ui`) tiene chat y config pero protección opcional
- Admin (`/admin`) tiene login 2FA pero solo métricas
- Seguridad fragmentada

**Solución: Unificar todo en `/admin`**

```
🌐 https://localhost:18789/admin

Panel Admin Unificado (con Login 2FA obligatorio)
├── 🔐 Login
│   └── Password + Código Telegram
│
├── 📊 Dashboard
│   ├── Métricas (mensajes, usuarios, tokens)
│   ├── Estado de canales
│   └── Health check
│
├── 💬 Chat (trasladado de /ui)
│   ├── Chat interactivo con agente
│   ├── Auto-configuración de APIs
│   ├── Ejecución de comandos
│   └── Historial de conversaciones
│
├── 🔌 Channels (trasladado de /ui)
│   ├── Configurar WhatsApp
│   ├── Configurar Discord
│   ├── Configurar Telegram
│   └── Escanear códigos QR
│
├── ⚙️ Config (trasladado de /ui)
│   ├── Editar config.json visualmente
│   ├── Formularios de configuración
│   └── Validación de cambios
│
├── 🤖 Agents (trasladado de /ui)
│   ├── Gestionar agentes
│   ├── Asignar herramientas
│   └── Configurar skills
│
└── 📈 Monitoring
    ├── Logs en tiempo real
    ├── Sesiones activas
    └── Uso de recursos
```

## 🔒 Seguridad Centralizada

```
Todas las rutas bajo /admin requieren:

1. Login con password
2. Verificación 2FA (código por Telegram)
3. Sesión válida (token JWT)
4. Rol: superadmin

Sin excepciones.
```

## 📁 Estructura de Archivos Propuesta

```
src/web/admin/
├── index.ts                 # Router principal
├── auth.ts                  # Autenticación 2FA (existente)
├── dashboard.ts             # Métricas (existente)
│
├── chat/                    # NUEVO (trasladado de ui/)
│   ├── controller.ts        # Adaptado de ui/controllers/chat.ts
│   ├── view.ts              # Adaptado de ui/views/chat.ts
│   └── styles.css           # Adaptado de ui/styles/chat.css
│
├── channels/                # NUEVO (trasladado de ui/)
│   ├── whatsapp.ts
│   ├── discord.ts
│   └── telegram.ts
│
├── config/                  # NUEVO (trasladado de ui/)
│   ├── form.ts
│   └── editor.ts
│
└── agents/                  # NUEVO (trasladado de ui/)
    ├── list.ts
    └── editor.ts
```

## 🚀 Ventajas

| Antes (Separado) | Después (Unificado) |
|-----------------|---------------------|
| 2 URLs diferentes | 1 URL: `/admin` |
| Seguridad opcional | Login obligatorio 2FA |
| Fragmentado | Todo en un lugar |
| Confusión para usuarios | Experiencia unificada |

## 🔄 Flujo de Uso

```bash
1. Usuario abre: https://localhost:18789/admin

2. Login 2FA:
   ├── Ingresa password
   ├── Recibe código por Telegram
   └── Ingresa código → Accede

3. Dashboard inicial:
   └── Ve métricas y estado del sistema

4. Necesita configurar WhatsApp:
   └── Clic en [Channels] → [WhatsApp]
   └── Escanear QR

5. Necesita integrar CRM:
   └── Clic en [Chat]
   └── Escribe: "Integrá Salesforce"
   └── El agente configura automáticamente

6. Todo protegido por el mismo login 2FA
```

## 🛡️ Seguridad Mejorada

```
Antes:
/ui/chat → Acceso potencialmente libre
   └── Podían chatear con el agente sin auth

Después:
/admin/chat → Requiere login 2FA
   └── Solo el dueño puede acceder
   └── Todo auditado y seguro
```

## 📋 Plan de Implementación

### Fase 1: Preparar estructura
```bash
# Crear nuevos directorios
mkdir -p src/web/admin/chat
mkdir -p src/web/admin/channels
mkdir -p src/web/admin/config
mkdir -p src/web/admin/agents
```

### Fase 2: Trasladar componentes de ui/
```bash
# Adaptar código de ui/ a admin/
# - Mantener funcionalidad
# - Agregar auth checks
# - Integrar con layout admin
```

### Fase 3: Unificar routing
```typescript
// src/web/admin/index.ts
const routes = {
  '/admin/login': loginView,
  '/admin/dashboard': dashboardView,
  '/admin/chat': chatView,        // NUEVO
  '/admin/channels': channelsView, // NUEVO
  '/admin/config': configView,     // NUEVO
  '/admin/agents': agentsView,     // NUEVO
};
```

### Fase 4: Testing
```bash
# Verificar que todo funcione con auth
# - Sin login → Redirige a /admin/login
# - Con login → Acceso completo
# - 2FA funciona correctamente
```

### Fase 5: Deprecar /ui
```bash
# ✅ Redirigir /ui a /admin (COMPLETADO)
# - Redirección 301 permanente implementada en src/gateway/control-ui.ts
# - Todas las rutas /ui/* redirigen a /admin/*
# - Los navegadores actualizarán automáticamente los bookmarks
```

## ✅ Checklist

- [ ] Trasladar chat de `ui/` a `admin/chat/`
- [ ] Trasladar channels de `ui/` a `admin/channels/`
- [ ] Trasladar config de `ui/` a `admin/config/`
- [ ] Trasladar agents de `ui/` a `admin/agents/`
- [ ] Asegurar que todas las rutas requieran auth
- [ ] Mantener 2FA obligatorio
- [ ] Actualizar documentación
- [x] Redirigir /ui a /admin

## 🎯 Resultado Final

```
Usuario accede a: http://localhost:18789/admin

┌─────────────────────────────────────────────────────────────┐
│  🔧 OpenClaw Admin                    [Usuario] 🔒 Logout   │
├─────────────────────────────────────────────────────────────┤
│  [Dashboard] [Chat] [Channels] [Config] [Agents] [Logs]     │
│                                                             │
│  📊 Dashboard                    │  💬 Chat (últimos msgs)  │
│  ┌──────────┐ ┌──────────┐      │  ┌─────────────────────┐ │
│  │ Mensajes │ │ Usuarios │      │  │ 🤖: ¿Qué necesitás? │ │
│  │  45.2K   │ │  1,234   │      │  │ [Escribir...]      │ │
│  └──────────┘ └──────────┘      │  └─────────────────────┘ │
│                                  │                          │
│  🟢 WhatsApp    🟢 Discord      │                          │
│                                  │                          │
└─────────────────────────────────────────────────────────────┘

Todo protegido por Login 2FA (Password + Telegram)
```

---

**Estado:** Propuesta de arquitectura
**Prioridad:** Alta (seguridad)
**Complejidad:** Media (reutilizar código existente de ui/)
