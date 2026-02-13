# Seguridad de Telegram - OpenClaw Superadmin

Esta guía explica el sistema de seguridad implementado para restringir el acceso al bot de Telegram exclusivamente al superadmin configurado.

## 🔒 Resumen de Seguridad

El bot de Telegram de OpenClaw implementa un sistema de autenticación de **un solo usuario** (superadmin) con las siguientes características:

- ✅ **Acceso exclusivo**: Solo el superadmin configurado puede interactuar con el bot
- ✅ **Bloqueo silencioso**: Usuarios no autorizados son ignorados sin notificación
- ✅ **Activación opcional**: Palabra clave configurable para activar el bot
- ✅ **Logging completo**: Todos los intentos de acceso son registrados
- ✅ **Sin rate limiting**: El superadmin no tiene límites de uso

## 🔐 Proceso de Activación

### Modo 1: Sin Palabra Clave (Activación Automática)

Si **NO** configuras `activationKeyword` en tu configuración:

```json
{
  "gateway": {
    "superadmin": {
      "telegramUserId": 123456789,
      "enabled": true
    }
  }
}
```

**Comportamiento:**
- ✅ El bot está **activo inmediatamente** para tu User ID
- ✅ Puedes enviar mensajes sin activación previa
- ✅ Otros usuarios siguen siendo bloqueados

### Modo 2: Con Palabra Clave (Activación Manual)

Si configuras `activationKeyword`:

```json
{
  "gateway": {
    "superadmin": {
      "telegramUserId": 123456789,
      "activationKeyword": "ACTIVAR_BOT_2024",
      "enabled": true
    }
  }
}
```

**Comportamiento:**
1. Al iniciar OpenClaw, el bot está **inactivo** para todos
2. Envías un mensaje con la palabra clave: `ACTIVAR_BOT_2024`
3. El bot responde: `✅ Bot activado. Ahora puedes usar todas las funcionalidades.`
4. A partir de ese momento, puedes usar el bot normalmente
5. La activación **persiste** mientras el bot esté corriendo

**Ventajas de usar palabra clave:**
- 🔒 Seguridad adicional si alguien obtiene acceso a tu configuración
- 🔒 Control manual de cuándo activar el bot
- 🔒 Puedes cambiar la palabra clave periódicamente

## 🛡️ Cómo Funciona la Seguridad

### Flujo de Verificación

Cada mensaje recibido pasa por estas verificaciones:

```
1. ¿Tiene User ID? → NO → ❌ BLOQUEADO
                    ↓ SÍ
2. ¿Es el superadmin? → NO → ❌ BLOQUEADO (logged)
                       ↓ SÍ
3. ¿Está activado? → NO → ❌ BLOQUEADO (mensaje de instrucción)
                    ↓ SÍ
4. ✅ PERMITIDO → Procesar mensaje
```

### Logging de Seguridad

Todos los intentos de acceso son registrados:

```
[telegram-superadmin-filter] Unauthorized access attempt from user 987654321
[telegram-superadmin-filter] Message from superadmin 123456789 allowed
[telegram-superadmin-filter] Bot activated for superadmin 123456789
```

Puedes revisar estos logs para detectar intentos de acceso no autorizados.

## 🔧 Cambiar Configuración de Seguridad

### Cambiar el Superadmin User ID

1. Detén OpenClaw
2. Edita `~/.openclaw/openclaw.json`:
   ```json
   {
     "gateway": {
       "superadmin": {
         "telegramUserId": 999888777,  // ← Nuevo User ID
         "enabled": true
       }
     }
   }
   ```
3. Reinicia OpenClaw
4. El bot ahora solo responderá al nuevo User ID

### Cambiar la Palabra Clave de Activación

1. Detén OpenClaw
2. Edita la configuración:
   ```json
   {
     "gateway": {
       "superadmin": {
         "telegramUserId": 123456789,
         "activationKeyword": "NUEVA_CLAVE_2024",  // ← Nueva palabra
         "enabled": true
       }
     }
   }
   ```
3. Reinicia OpenClaw
4. Envía la nueva palabra clave para activar

### Eliminar la Palabra Clave (Activación Automática)

1. Detén OpenClaw
2. Elimina o deja vacío el campo `activationKeyword`:
   ```json
   {
     "gateway": {
       "superadmin": {
         "telegramUserId": 123456789,
         "activationKeyword": "",  // ← Vacío
         "enabled": true
       }
     }
   }
   ```
3. Reinicia OpenClaw
4. El bot estará activo automáticamente

### Desactivar Temporalmente el Modo Superadmin

Para volver al modo legacy (todos los usuarios pueden usar el bot):

```json
{
  "gateway": {
    "superadmin": {
      "telegramUserId": 123456789,
      "enabled": false  // ← Desactivado
    }
  }
}
```

**⚠️ Advertencia**: Con `enabled: false`, **cualquier usuario** podrá interactuar con tu bot de Telegram.

## 🔍 Troubleshooting

### El bot no responde a mis mensajes

**Posibles causas:**

1. **User ID incorrecto**
   - Verifica que el `telegramUserId` en la configuración coincida exactamente con tu ID real
   - Usa `@userinfobot` en Telegram para confirmar tu User ID
   - Revisa los logs: `Unauthorized access attempt from user XXXXX`

2. **Bot no activado**
   - Si configuraste `activationKeyword`, asegúrate de haberla enviado
   - Revisa los logs: `Pending activation message sent to superadmin`
   - Envía la palabra clave exacta (case-sensitive)

3. **Configuración no cargada**
   - Reinicia OpenClaw después de cambiar la configuración
   - Verifica que el archivo JSON sea válido (sin errores de sintaxis)
   - Revisa los logs de inicio de OpenClaw

### El bot responde a otros usuarios

**Posibles causas:**

1. **Modo superadmin desactivado**
   - Verifica que `enabled: true` en la configuración
   - Revisa los logs: `Superadmin filter disabled`

2. **Configuración no presente**
   - Si no existe la sección `gateway.superadmin`, el bot funciona en modo legacy
   - Agrega la configuración completa

### No puedo encontrar mi User ID

**Soluciones:**

1. Usa `@userinfobot` en Telegram (método más confiable)
2. Usa `@getidsbot` en Telegram
3. Revisa los logs de OpenClaw cuando envías un mensaje (aparecerá tu User ID)

### La palabra clave no funciona

**Verificaciones:**

1. **Case-sensitive**: `ACTIVAR` ≠ `activar`
2. **Espacios**: Elimina espacios extra al inicio/final
3. **Caracteres especiales**: Evita emojis o caracteres raros
4. **Mensaje completo**: La palabra puede estar dentro de un mensaje más largo

### Quiero cambiar de superadmin a otro usuario

1. Obtén el User ID del nuevo superadmin
2. Actualiza `telegramUserId` en la configuración
3. Reinicia OpenClaw
4. El usuario anterior **perderá acceso inmediatamente**
5. El nuevo usuario debe activar el bot (si hay palabra clave)

## 🔐 Mejores Prácticas de Seguridad

### ✅ Recomendaciones

1. **Usa palabra clave de activación**
   - Agrega una capa extra de seguridad
   - Cámbiala periódicamente (cada 1-3 meses)

2. **Mantén seguro tu User ID**
   - No lo compartas públicamente
   - No lo incluyas en repositorios públicos

3. **Revisa los logs regularmente**
   - Busca intentos de acceso no autorizados
   - Monitorea patrones sospechosos

4. **Usa variables de entorno para tokens**
   - No incluyas el token del bot en el código
   - Usa `.env` o variables de sistema

5. **Configura el bot correctamente**
   - Verifica que `enabled: true`
   - Confirma el User ID antes de desplegar

### ❌ Evita

1. **No compartas tu configuración**
   - El archivo `openclaw.json` contiene información sensible
   - No lo subas a repositorios públicos

2. **No uses User IDs predecibles**
   - No uses `0`, `1`, `123`, etc. como User ID de prueba

3. **No desactives el modo superadmin en producción**
   - Solo desactiva para testing local
   - Siempre mantén `enabled: true` en producción

## 🚨 Qué Hacer si Hay un Acceso No Autorizado

Si detectas intentos de acceso no autorizados en los logs:

1. **Inmediato**:
   - Cambia la palabra clave de activación
   - Verifica que tu User ID sea correcto
   - Reinicia OpenClaw

2. **Investigación**:
   - Revisa los logs completos
   - Identifica el User ID del atacante
   - Verifica si hay patrones de ataque

3. **Prevención**:
   - Cambia el token del bot de Telegram (si fue comprometido)
   - Revisa permisos de archivos de configuración
   - Considera agregar monitoreo adicional

## 📞 Soporte

Si encuentras problemas de seguridad:

1. Revisa esta documentación completa
2. Verifica los logs de OpenClaw
3. Consulta `docs/transformation/SETUP.md` para configuración básica
4. Revisa el código fuente en `src/telegram/superadmin-auth.ts`

---

**Última actualización**: 2026-02-12  
**Versión**: 1.0  
**Estado**: Implementado y probado
