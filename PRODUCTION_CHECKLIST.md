# Agento - Checklist de Producción

Este documento contiene las verificaciones necesarias antes de desplegar Agento en un entorno de producción.

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

## Checklist Previo a Producción

### Seguridad del Gateway

- [ ] **Autenticación configurada**
  - Token o password establecido en `gateway.auth.token` o `gateway.auth.password`
  - Token generado de forma segura (mínimo 32 caracteres aleatorios)
  - Token almacenado en variable de entorno, no en código

- [ ] **Modo de autenticación localhost**
  - `gateway.auth.requireLocalAuth: true` para máxima seguridad
  - O `false` solo si el gateway nunca se expone fuera del host

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

## Configuración Recomendada para Producción

### agento.json

```json5
{
  gateway: {
    port: 18789,
    mode: "local",
    bind: "lan",  // o "tailscale" para remoto
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

  channels: {
    telegram: {
      enabled: true,
      botToken: "${TELEGRAM_BOT_TOKEN}",
      dmPolicy: "pairing",
      allowFrom: ["123456789"]  // Tu user ID
    },
    whatsapp: {
      enabled: true,
      accounts: {
        ventas: {
          phoneNumber: "+5491112345678",
          role: "public",
          purpose: "Atención al público"
        }
      }
    }
  },

  agents: {
    defaults: {
      model: {
        primary: "deepseek/deepseek-chat",
        fallbacks: ["openai/gpt-4o"]
      }
    }
  },

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

## Despliegue con Docker

### Construcción de Imagen

```bash
# Construir imagen local
docker build -t agento:latest .

# O usar docker-compose
docker-compose build
```

### Ejecución con Docker Compose

```bash
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

---

## Comandos Útiles

```bash
# Diagnóstico completo
agento doctor

# Validar configuración
agento config validate

# Ver estado del sistema
agento status --all

# Verificar seguridad
agento security audit

# Logs en tiempo real
agento logs --follow

# Reiniciar gateway
agento gateway restart
```

---

## Contacto y Soporte

- Documentación: https://docs.agento.ai
- Issues: https://github.com/agent-oh/agento/issues
- Discord: https://discord.gg/agento

---

*Última actualización: 2026-02-14*
