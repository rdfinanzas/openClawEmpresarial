# Recomendaciones de Seguridad - OpenClaw Empresarial

## 1. Forzar Bind Loopback

Modificar `onboarding.gateway-config.ts`:

```typescript
// Agregar validación para modo empresarial
if (isEnterpriseMode() && bind !== 'loopback') {
  await prompter.note(
    "⚠️ Modo empresarial requiere bind=loopback por seguridad",
    "Seguridad"
  );
  bind = 'loopback';
}
```

## 2. Configurar Roles de Canal Automáticamente

Modificar `onboard-channels.ts` para aplicar roles:

```typescript
// Después de configurar cada canal
const role = getDefaultRoleForChannel(channel); // telegram=superadmin, otros=public
next = applyChannelRole(next, channel, role);
```

## 3. Restringir Configuración de APIs

Modificar `enterprise-cli.ts`:

```typescript
export function registerEnterpriseCli(program: Command): void {
  const enterprise = program
    .command("enterprise")
    .description("Enterprise API management (superadmin only)")
    .hook('preAction', async (thisCommand) => {
      // Verificar superadmin antes de ejecutar
      const isSuperadmin = await verifySuperadminAccess();
      if (!isSuperadmin) {
        throw new Error("⛔ Solo el superadmin puede gestionar APIs empresariales");
      }
    });
  // ...
}
```

## 4. Validación de Skills en Modo Empresarial

En `onboard-skills.ts`, filtrar skills peligrosas:

```typescript
const ENTERPRISE_SAFE_SKILLS = [
  'weather', 'local-places', 'healthcheck', 
  'summarize', 'session-logs'
];

// Bloquear skills peligrosas en modo empresarial
const blockedSkills = skills.filter(s => 
  !ENTERPRISE_SAFE_SKILLS.includes(s.name) && 
  isEnterpriseMode()
);
```

## 5. Configuración Recomendada para config.json

```json
{
  "gateway": {
    "port": 18789,
    "mode": "local",
    "bind": "loopback",
    "trustedProxies": ["127.0.0.1"],
    "auth": {
      "mode": "token",
      "token": "GENERAR_TOKEN_SEGURO"
    }
  },
  "channels": {
    "telegram": {
      "enabled": true,
      "role": "superadmin",
      "dmPolicy": "allowlist",
      "accounts": {
        "admin": {
          "default": true,
          "enabled": true,
          "allowFrom": [TELEGRAM_USER_ID]
        }
      }
    },
    "whatsapp": {
      "enabled": true,
      "role": "public",
      "dmPolicy": "open"
    }
  },
  "enterprise": {
    "apis": {
      // Solo configurables por superadmin
    }
  }
}
```

## 6. Lista de Verificación de Seguridad

- [ ] Gateway bind = loopback (no lan/auto)
- [ ] Telegram configurado como superadmin
- [ ] WhatsApp/Discord configurados como public
- [ ] Tool filter activado para rol public
- [ ] Root authorization habilitado
- [ ] Admin panel con 2FA habilitado
- [ ] Skills peligrosas bloqueadas para public
- [ ] APIs empresariales requieren superadmin para configurar
