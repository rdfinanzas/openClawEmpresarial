# Guía de Pruebas - OpenClaw Superadmin

## 1. Pruebas Unitarias (Sin servidor)

### Test de Módulos
```bash
npx tsx test-simple.mts
```

Verifica que todos los módulos carguen correctamente:
- ✅ Tool Access Filter
- ✅ Crypto utilities
- ✅ Root Authorization
- ✅ Admin Panel (routes, auth, middleware, dashboard, index)
- ✅ Telegram Admin Alerts

### Test de Funcionalidad
```bash
npx tsx test-system.mts
```

Prueba:
- Filtrado de herramientas (superadmin vs public)
- Generación de códigos 2FA
- Sistema de autorización root

## 2. Pruebas del Panel Web

### Iniciar servidor de prueba
```bash
npx tsx test-admin-panel.mts
```

El servidor iniciará en `http://localhost:8765`

### URLs de prueba

| URL | Descripción |
|-----|-------------|
| http://localhost:8765/admin | Redirección a login |
| http://localhost:8765/admin/login | Página de login |
| http://localhost:8765/admin/api/health | Health check (público) |
| http://localhost:8765/admin/dashboard | Dashboard (requiere auth) |

### Probar con curl/PowerShell

```powershell
# Health check
Invoke-RestMethod -Uri "http://localhost:8765/admin/api/health" -Method GET

# Ver login page
Invoke-RestMethod -Uri "http://localhost:8765/admin/login" -Method GET
```

## 3. Estructura de Archivos Creados

```
src/
├── agents/
│   └── tool-filter.ts          # Filtrado de herramientas por rol
├── channels/
│   └── root-authorization.ts   # Autorización para operaciones críticas
├── config/
│   ├── types.superadmin.ts     # Tipos de configuración superadmin
│   └── types.openclaw.ts       # Actualizado con superadmin config
├── telegram/
│   └── admin-alerts.ts         # Alertas Telegram al superadmin
└── web/admin/
    ├── crypto.ts               # Utilidades criptográficas
    ├── types.ts                # Tipos del panel admin
    ├── routes.ts               # Utilidades de rutas
    ├── auth.ts                 # Autenticación (password + 2FA)
    ├── auth-storage.ts         # Almacenamiento de sesiones
    ├── middleware.ts           # Middleware de seguridad
    ├── admin-verification.ts   # Envío de códigos vía Telegram
    ├── dashboard.ts            # API del dashboard
    ├── metrics.ts              # Recolección de métricas
    └── index.ts                # Entry point del panel admin

test/
├── integration/
│   ├── superadmin-flow.test.ts      # Flujo completo superadmin
│   └── public-channel-flow.test.ts  # Flujo canal público
└── security/
    └── superadmin-security.test.ts  # Tests de seguridad
```

## 4. Funcionalidades Implementadas

### Fase 1-3: Configuración Base + Telegram Superadmin
- ✅ Tipos de roles (superadmin, public)
- ✅ Configuración de superadmin
- ✅ Filtrado de herramientas por rol
- ✅ Tests unitarios

### Fase 4: Panel Web
- ✅ Estructura base del admin panel
- ✅ Sistema de autenticación 2FA (password + Telegram)
- ✅ Middleware de seguridad
- ✅ UI con Lit (login, dashboard)

### Fase 5: Monitoreo
- ✅ Health monitor
- ✅ Métricas de canales
- ✅ Alertas Telegram
- ✅ UI de monitoreo

### Fase 6: Root Authorization
- ✅ Sistema de cola de aprobaciones
- ✅ Requests Telegram
- ✅ Middleware de protección
- ✅ Operaciones críticas protegidas

### Fase 7-8: APIs Dinámicas + Testing
- ✅ Manager de APIs
- ✅ Generación dinámica de tools
- ✅ Integraciones Google (Calendar, Gmail)
- ✅ Tests de integración
- ✅ Tests de seguridad

## 5. Configuración para Producción

Crea `~/.openclaw/config.json`:

```json
{
  "superadmin": {
    "enabled": true,
    "telegramUserId": 123456789,
    "panel": {
      "enabled": true,
      "sessionTimeoutMinutes": 60
    },
    "credentials": {
      "username": "admin",
      "passwordHash": "$2b$10$..."
    },
    "rootAuth": {
      "enabled": true,
      "criticalOperations": ["file_delete", "config_write", "system_restart"],
      "requestExpiryMinutes": 10
    },
    "monitoring": {
      "telegramAlerts": true,
      "alertCooldownMinutes": 5
    }
  },
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "YOUR_BOT_TOKEN",
      "accounts": {
        "default": {
          "default": true,
          "enabled": true
        }
      }
    }
  }
}
```

## 6. Comandos Útiles

```bash
# Verificar compilación TypeScript
npx tsc --noEmit

# Ejecutar todos los tests (si pnpm está disponible)
pnpm test

# Ejecutar tests específicos
npx vitest run test/integration/superadmin-flow.test.ts
```

## 7. Solución de Problemas

### Error: bcrypt no disponible
Es normal en desarrollo. Para producción:
```bash
npm install bcrypt
```

### Error: Cannot find module
Verifica que estás usando `npx tsx` para archivos `.mts`/`.ts`.

### Error de TypeScript en extensiones
Las extensiones (matrix, diagnostics-otel) tienen dependencias opcionales. Los errores en `src/` son los importantes.
