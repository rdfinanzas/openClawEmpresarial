# Cómo Funciona la Configuración en OpenClaw Empresarial

## 🎯 Concepto Principal

**OpenClaw original** ya tiene un wizard de configuración que pregunta:
1. ¿Quién eres? (nombre del bot)
2. ¿Qué haces? (system prompt)
3. ¿Qué modelo de IA usar? (Claude, GPT, etc.)
4. ¿Qué skills necesitas? (herramientas adicionales)

**Nuestra versión Empresarial** extiende esto para que también pregunte:
5. ¿Qué APIs de negocio tienes? (stock, precios, pedidos)
6. ¿Cuáles son las URLs de esas APIs?

---

## 🔄 Flujo de Configuración Automática

### Paso 1: Wizard Original (OpenClaw)
```
$ openclaw onboard

🤖 Bienvenido a OpenClaw

1. ¿Cómo quieres llamar a tu asistente?
   > Almacén Don José

2. ¿Qué hace tu asistente?
   > Soy el asistente virtual del Almacén Don José. 
   > Ayudo a consultar stock, precios y crear pedidos.

3. Selecciona modelo de IA:
   > Claude 3.5 Sonnet

4. Configurar skills:
   > [X] filesystem (para leer archivos)
   > [ ] browser (para navegar web)
```

### Paso 2: Wizard Empresarial (Nuestro Agregado)
```
5. 🏪 Configuración Empresarial

   ¿Tienes APIs para consultar stock?
   > Sí
   URL de la API de stock:
   > https://api.mitienda.com/v1/stock
   
   ¿Tienes APIs para consultar precios?
   > Sí
   URL de la API de precios:
   > https://api.mitienda.com/v1/prices
   
   ¿Tienes APIs para crear pedidos?
   > Sí
   URL de la API de pedidos:
   > https://api.mitienda.com/v1/orders

6. ✅ Configuración completa!
   
   Las APIs han sido registradas como tools disponibles.
   El agente podrá usarlas automáticamente según la conversación.
```

---

## 🧠 Cómo el Agente "Aprende" las APIs

### Opción A: Auto-Descubrimiento (OpenAPI/Swagger)
```javascript
// El sistema detecta automáticamente las capacidades de la API
GET https://api.mitienda.com/openapi.json

{
  "paths": {
    "/stock": {
      "get": {
        "summary": "Consultar stock de productos",
        "parameters": [
          { "name": "producto", "type": "string" }
        ]
      }
    }
  }
}

// El sistema genera automáticamente:
// tool: "check_stock"
// description: "Consultar stock de productos"
// parameters: { producto: string }
```

### Opción B: Configuración Manual (Wizard)
```javascript
// El admin configura manualmente durante el wizard
{
  "enterprise": {
    "apis": [
      {
        "id": "check_stock",
        "name": "Consultar Stock",
        "endpoint": "https://api.mitienda.com/v1/stock",
        "method": "GET",
        "parameters": [
          { "name": "producto", "type": "string", "required": true }
        ]
      }
    ]
  }
}
```

---

## 🔧 Implementación: Extendiendo el Wizard

Vamos a agregar la configuración empresarial al wizard existente:```typescript
// src/wizard/onboarding-enterprise.ts
// Extensión del wizard para configuración empresarial

export async function setupEnterpriseApis(
  config: OpenClawConfig,
  prompter: WizardPrompter,
): Promise<OpenClawConfig> {
  await prompter.note(
    "Configuración de APIs Empresariales",
    "Atención al Cliente"
  );

  const hasApis = await prompter.confirm({
    message: "¿Tienes APIs para consultar stock/precios/pedidos?",
    initialValue: false,
  });

  if (!hasApis) {
    return config;
  }

  // Preguntar por cada tipo de API
  const apis = [];

  const hasStockApi = await prompter.confirm({
    message: "¿API para consultar stock?",
    initialValue: true,
  });
  
  if (hasStockApi) {
    const endpoint = await prompter.text({
      message: "URL de la API de stock",
      placeholder: "https://api.tuempresa.com/v1/stock",
    });
    apis.push({ id: "check_stock", endpoint });
  }

  const hasPriceApi = await prompter.confirm({
    message: "¿API para consultar precios?",
    initialValue: true,
  });
  
  if (hasPriceApi) {
    const endpoint = await prompter.text({
      message: "URL de la API de precios",
      placeholder: "https://api.tuempresa.com/v1/prices",
    });
    apis.push({ id: "get_price", endpoint });
  }

  const hasOrderApi = await prompter.confirm({
    message: "¿API para crear pedidos?",
    initialValue: true,
  });
  
  if (hasOrderApi) {
    const endpoint = await prompter.text({
      message: "URL de la API de pedidos",
      placeholder: "https://api.tuempresa.com/v1/orders",
    });
    apis.push({ id: "create_order", endpoint });
  }

  // Guardar en la configuración
  return {
    ...config,
    enterprise: {
      apis: apis.reduce((acc, api) => {
        acc[api.id] = { endpoint: api.endpoint };
        return acc;
      }, {}),
    },
  };
}
```

---

## 🚀 Uso en Producción

### Escenario 1: Primera vez (Onboarding)
```bash
$ openclaw onboard

# El wizard guía paso a paso:
# 1. Configuración general (OpenClaw original)
# 2. Configuración de canales (Telegram, WhatsApp)
# 3. Configuración empresarial (nuestro agregado)
```

### Escenario 2: Agregar APIs después
```bash
# Comando nuevo para configurar APIs empresariales
$ openclaw enterprise setup

🏪 Configuración de APIs Empresariales

¿Quieres agregar una API de stock? [s/n]: s
URL: https://api.mitienda.com/stock
Verificando conexión... ✅

¿Quieres agregar una API de precios? [s/n]: s
URL: https://api.mitienda.com/prices
Verificando conexión... ✅

APIs configuradas correctamente!
```

### Escenario 3: Auto-configuración desde OpenAPI
```bash
# Si tienes un archivo OpenAPI/Swagger
$ openclaw enterprise import https://api.mitienda.com/openapi.json

Analizando API... 🔍

Endpoints detectados:
  ✅ GET  /stock    -> check_stock
  ✅ GET  /prices   -> get_price
  ✅ POST /orders   -> create_order

¿Quieres importar estos endpoints? [s/n]: s
Importando... ✅

Las APIs han sido registradas y están listas para usar!
```

---

## 📊 Cómo el Agente Usa las APIs

### Ejemplo de Conversación

**Cliente WhatsApp:** "¿Tenés arroz?"

**Proceso Interno:**
```
1. Mensaje llega a OpenClaw
2. Detecta canal: WhatsApp -> Rol: PUBLIC
3. Consulta tools disponibles para PUBLIC:
   - check_stock ✅
   - get_price ✅
   - create_order ✅
   - search_web ❌ (no está permitido)

4. Envia a Claude con contexto:
   {
     "message": "¿Tenés arroz?",
     "available_tools": [
       {
         "name": "check_stock",
         "description": "Consultar disponibilidad de productos",
         "parameters": { "producto": "string" }
       }
     ]
   }

5. Claude decide usar: check_stock(producto="arroz")

6. OpenClaw ejecuta la API:
   GET https://api.mitienda.com/stock?producto=arroz
   
   Response: { "disponible": true, "cantidad": 50 }

7. Claude genera respuesta:
   "¡Sí! Tenemos arroz disponible. Tenemos 50 unidades en stock."

8. Envía respuesta al cliente por WhatsApp
```

---

## 🎛️ Panel Admin Web

Desde `http://localhost:18789/admin` podrás:

### 1. Ver APIs Configuradas
```
┌─────────────────────────────────────────────┐
│ APIs Empresariales                          │
├─────────────────────────────────────────────┤
│ ✅ check_stock                              │
│    https://api.mitienda.com/stock           │
│    Último uso: hace 5 minutos               │
│                                             │
│ ✅ get_price                                │
│    https://api.mitienda.com/prices          │
│    Último uso: hace 2 minutos               │
│                                             │
│ ✅ create_order                             │
│    https://api.mitienda.com/orders          │
│    Último uso: hace 1 hora                  │
└─────────────────────────────────────────────┘
```

### 2. Agregar Nueva API
```
[+] Agregar API

Nombre: Consultar Cliente
ID: check_customer
URL: https://api.mitienda.com/customers
Método: GET
Parámetros: { "telefono": "string" }

[Testear conexión] [Guardar]
```

### 3. Ver Logs de Uso
```
┌─────────────────────────────────────────────┐
│ Últimas Consultas                           │
├─────────────────────────────────────────────┤
│ 10:30 AM - check_stock("arroz") ✅          │
│ 10:32 AM - get_price("fideos") ✅           │
│ 10:35 AM - create_order(...) ✅             │
│ 10:40 AM - search_web("clima") ❌ Bloqueado │
└─────────────────────────────────────────────┘
```

---

## ✅ Resumen: ¿Qué está implementado?

| Feature | Estado | Descripción |
|---------|--------|-------------|
| Roles (Superadmin/Public) | ✅ | Telegram=superadmin, WhatsApp=public |
| Tool Filter | ✅ | Filtra tools según rol |
| Root Auth | ✅ | Aprobación para operaciones críticas |
| Admin Panel | ✅ | Web UI con 2FA |
| API Manager | ✅ | Sistema para registrar APIs |
| **Wizard Enterprise** | 🔄 | Extensión del wizard original |
| **Auto-configuración** | 🔄 | Importar desde OpenAPI |

🔄 = Falta implementar, pero es fácil de agregar

---

## 🚀 Siguiente Paso

¿Quieres que implementemos la extensión del wizard para que pregunte por las APIs empresariales durante el `openclaw onboard`?

O prefieres que hagamos primero el comando `openclaw enterprise setup` para configurar las APIs después?
