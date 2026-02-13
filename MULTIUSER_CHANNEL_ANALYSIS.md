# Análisis: Múltiples Usuarios y Comportamiento por Canal

## 1. AISLAMIENTO DE SESIONES (Ya implementado ✅)

OpenClaw ya tiene un sistema robusto para aislar conversaciones de múltiples usuarios:

### Session Keys Únicas
Cada conversación se identifica con una key única:
```
agent:main:whatsapp:dm:+15551234567     ← Usuario 1
agent:main:whatsapp:dm:+15559876543     ← Usuario 2
agent:main:telegram:dm:123456789        ← Usuario 3
```

### dmScope - Aislamiento configurable
En `config.json`:
```json
{
  "session": {
    "dmScope": "per-channel-peer"
  }
}
```

Opciones:
- `"main"`: Todos comparten la misma sesión (no recomendado para empresas)
- `"per-peer"`: Aislar por usuario globalmente
- `"per-channel-peer"`: Aislar por canal + usuario (recomendado)
- `"per-account-channel-peer"`: Aislar por cuenta + canal + usuario

### Almacenamiento local
Las sesiones se guardan en archivos JSONL locales:
- `~/.openclaw/sessions/{sessionKey}.jsonl`
- Cada usuario tiene su propio historial aislado

---

## 2. SYSTEM PROMPT POR CANAL (Ya implementado parcialmente ⚠️)

El sistema SÍ soporta system prompts específicos por canal:

### Canales soportados actualmente:
| Canal | systemPrompt en config |
|-------|------------------------|
| Telegram | ✅ Sí (grupos y topics) |
| Discord | ✅ Sí (guilds) |
| Slack | ✅ Sí (canales) |
| **WhatsApp** | ❌ **NO** - Necesita implementarse |

### Cómo funciona:
1. Se configura en `config.json`:
```json
{
  "channels": {
    "telegram": {
      "groups": {
        "mi-grupo": {
          "systemPrompt": "Eres un asistente para ventas..."
        }
      }
    }
  }
}
```

2. El canal inyecta el prompt en `GroupSystemPrompt`

3. Se pasa como `extraSystemPrompt` al agente

4. Aparece en el system prompt final:
```
## Group Chat Context
Eres un asistente para ventas...
```

---

## 3. QUÉ NECESITAMOS IMPLEMENTAR

### A. Agregar systemPrompt a WhatsApp

Modificar `src/config/types.whatsapp.ts`:
```typescript
export type WhatsAppConfig = {
  // ... existing fields ...
  
  /** Optional system prompt for DMs */
  systemPrompt?: string;
  
  /** Per-group configuration */
  groups?: Record<string, {
    requireMention?: boolean;
    tools?: GroupToolPolicyConfig;
    toolsBySender?: GroupToolPolicyBySenderConfig;
    systemPrompt?: string;  // <-- AGREGAR
  }>;
};
```

### B. Modificar WhatsApp message handler

En `src/whatsapp/` (necesitamos encontrar el archivo correspondiente), agregar:
```typescript
const systemPromptParts = [
  config.systemPrompt?.trim() || null,
  groupConfig?.systemPrompt?.trim() || null,
].filter(Boolean);

const groupSystemPrompt = systemPromptParts.length > 0 
  ? systemPromptParts.join("\n\n") 
  : undefined;

// En el contexto del mensaje:
GroupSystemPrompt: groupSystemPrompt,
```

### C. Wizard de configuración por roles

Modificar el wizard para:

1. **Paso 1: Configurar Telegram (Superadmin)**
   ```typescript
   // Configuración automática
   {
     "channels": {
       "telegram": {
         "enabled": true,
         "role": "superadmin",
         "dmPolicy": "allowlist",
         "accounts": {
           "admin": {
             "default": true,
             "allowFrom": [TELEGRAM_USER_ID]
           }
         },
         // System prompt para admin
         "systemPrompt": "Eres el asistente administrativo del negocio. Tienes acceso completo al sistema. Puedes ejecutar comandos, consultar información sensible, y realizar operaciones críticas."
       }
     }
   }
   ```

2. **Paso 2: Configurar WhatsApp (Público)**
   ```typescript
   // Configuración automática
   {
     "channels": {
       "whatsapp": {
         "enabled": true,
         "role": "public",
         "dmPolicy": "open",
         // System prompt para clientes
         "systemPrompt": "Eres el asistente virtual de atención al cliente de [NOMBRE_NEGOCIO].\n\nTU ÚNICA FUNCIÓN es ayudar con:\n1. Consultar stock de productos\n2. Ver precios\n3. Crear pedidos\n4. Consultar estado de pedidos\n\nREGLAS ESTRICTAS:\n- NO puedes buscar en internet\n- NO puedes ejecutar comandos del sistema\n- NO puedes modificar archivos\n- NO respondas preguntas sobre temas generales (clima, noticias, etc.)\n- Si te preguntan algo fuera de estos temas, responde: 'Lo siento, solo puedo ayudarte con consultas sobre nuestros productos y pedidos. ¿En qué producto estás interesado?'\n\nSiempre sé amable, profesional y conciso."
       }
     }
   }
   ```

---

## 4. CÓMO APRENDE EL AGENTE

El agente NO aprende automáticamente. Las instrucciones se dan mediante:

### System Prompt (en cada mensaje)
El system prompt completo se construye así:
```
[Prompt base de OpenClaw]
[Tools disponibles según el rol]
[Skills configuradas]
## Group Chat Context  <-- Aquí va el system prompt del canal
[Especificaciones del canal]
```

### Tool Filtering (restricción de herramientas)
- Telegram (superadmin): Todas las herramientas disponibles
- WhatsApp (public): Solo `api_*`, `enterprise_*`, y herramientas seguras

### Session Memory (memoria por sesión)
Cada usuario tiene su propio historial, pero el system prompt se inyecta en cada mensaje.

---

## 5. EJEMPLO COMPLETO DE CONFIGURACIÓN

```json
{
  "agents": {
    "defaults": {
      "model": "anthropic:claude-3-5-sonnet",
      "systemPrompt": "Eres un asistente útil."
    }
  },
  
  "session": {
    "dmScope": "per-channel-peer"
  },
  
  "channels": {
    "telegram": {
      "enabled": true,
      "role": "superadmin",
      "dmPolicy": "allowlist",
      "systemPrompt": "Eres el administrador del sistema. Tienes acceso total.",
      "accounts": {
        "admin": {
          "default": true,
          "enabled": true,
          "allowFrom": [123456789]
        }
      }
    },
    
    "whatsapp": {
      "enabled": true,
      "role": "public", 
      "dmPolicy": "open",
      "systemPrompt": "Eres el asistente de ventas. SOLO puedes: consultar stock, precios, crear pedidos. NO busques en internet. NO ejecutes comandos.",
      "dms": {
        "+1234567890": {
          "responsePrefix": "👤"
        }
      }
    }
  },
  
  "enterprise": {
    "apis": {
      "check_stock": {
        "endpoint": "https://api.tuempresa.com/stock",
        "method": "GET"
      }
    }
  }
}
```

---

## 6. RESUMEN DE IMPLEMENTACIÓN NECESARIA

| Feature | Estado | Archivos a modificar |
|---------|--------|---------------------|
| Aislamiento de sesiones | ✅ Listo | Configurar `session.dmScope` |
| Tool filtering por rol | ✅ Listo | `src/agents/tool-filter.ts` |
| System prompt Telegram | ✅ Listo | Ya soportado |
| System prompt Discord | ✅ Listo | Ya soportado |
| **System prompt WhatsApp** | ❌ **Falta** | `src/config/types.whatsapp.ts` + handler |
| Wizard de configuración | ⚠️ Parcial | Modificar `onboard-channels.ts` |
| Enseñar al agente | ✅ Listo | Via system prompt |
