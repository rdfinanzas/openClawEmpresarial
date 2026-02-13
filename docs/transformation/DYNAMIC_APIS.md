# APIs Dinámicas - Documentación

Esta guía explica cómo usar el sistema de APIs dinámicas de OpenClaw para integrar servicios externos.

## 📋 Tabla de Contenidos

- [Introducción](#introducción)
- [Conceptos Básicos](#conceptos-básicos)
- [Registro de APIs](#registro-de-apis)
- [Tipos de Autenticación](#tipos-de-autenticación)
- [Generación de Tools](#generación-de-tools)
- [Ejecución de Llamadas](#ejecución-de-llamadas)
- [Ejemplos Prácticos](#ejemplos-prácticos)
- [Troubleshooting](#troubleshooting)

## 🎯 Introducción

El sistema de APIs dinámicas permite:
- ✅ Registrar APIs externas sin modificar código
- ✅ Generar herramientas automáticamente desde endpoints
- ✅ Ejecutar llamadas con retry logic y manejo de errores
- ✅ Gestionar autenticación de múltiples tipos
- ✅ Administrar APIs desde el panel web

## 📚 Conceptos Básicos

### API Dinámica

Una API dinámica es una configuración que describe:
- **Identificación**: ID único y nombre descriptivo
- **Conexión**: URL base y configuración de red
- **Autenticación**: Tipo y credenciales
- **Endpoints**: Lista de operaciones disponibles
- **Metadata**: Tags, descripción, estado

### Endpoint

Un endpoint representa una operación de la API:
- **Nombre**: Identificador único del endpoint
- **Path**: Ruta relativa a la URL base
- **Método**: GET, POST, PUT, PATCH, DELETE
- **Parámetros**: Lista de parámetros con tipos y validación

### Tool Generado

Cada endpoint se convierte en una herramienta que el agente puede usar:
- **Nombre**: Generado automáticamente (ej: `api_crm_api_getcustomers`)
- **Descripción**: Derivada del endpoint y la API
- **Parámetros**: Esquema JSON Schema generado automáticamente

## 🔧 Registro de APIs

### Estructura de Configuración

```json
{
  "id": "crm-api",
  "name": "CRM API",
  "baseUrl": "https://api.crm.example.com",
  "description": "API de gestión de clientes",
  "auth": {
    "type": "bearer",
    "bearerToken": "your-token-here"
  },
  "endpoints": [
    {
      "name": "getCustomers",
      "path": "/customers",
      "method": "GET",
      "description": "Obtiene lista de clientes"
    },
    {
      "name": "createCustomer",
      "path": "/customers",
      "method": "POST",
      "description": "Crea un nuevo cliente",
      "parameters": [
        {
          "name": "name",
          "type": "string",
          "required": true,
          "description": "Nombre del cliente"
        },
        {
          "name": "email",
          "type": "string",
          "required": true,
          "description": "Email del cliente"
        }
      ]
    }
  ],
  "enabled": true,
  "tags": ["crm", "sales"]
}
```

### Registro Programático

```typescript
import { dynamicAPIManager } from './src/enterprise/dynamic-api-manager.js';

const apiConfig = {
  id: 'crm-api',
  name: 'CRM API',
  // ... resto de la configuración
};

dynamicAPIManager.registerAPI(apiConfig);
```

### Registro vía Panel Web

1. Accede al panel de administración
2. Navega a "Gestión de APIs"
3. Click en "Agregar Nueva API"
4. Completa el formulario
5. Guarda la configuración

## 🔐 Tipos de Autenticación

### Sin Autenticación

```json
{
  "auth": {
    "type": "none"
  }
}
```

### Bearer Token

```json
{
  "auth": {
    "type": "bearer",
    "bearerToken": "your-bearer-token"
  }
}
```

### API Key

```json
{
  "auth": {
    "type": "api_key",
    "apiKey": "your-api-key",
    "apiKeyHeader": "X-API-Key"  // Opcional, default: X-API-Key
  }
}
```

### Basic Auth

```json
{
  "auth": {
    "type": "basic",
    "username": "your-username",
    "password": "your-password"
  }
}
```

### OAuth2

```json
{
  "auth": {
    "type": "oauth2",
    "oauth2": {
      "clientId": "your-client-id",
      "clientSecret": "your-client-secret",
      "tokenUrl": "https://auth.example.com/token",
      "accessToken": "current-access-token",
      "refreshToken": "refresh-token"
    }
  }
}
```

## 🛠️ Generación de Tools

### Proceso Automático

El sistema genera automáticamente herramientas para cada endpoint:

```typescript
import { toolGenerator } from './src/enterprise/tool-generator.js';

const api = dynamicAPIManager.getAPI('crm-api');
const tools = toolGenerator.generateToolsFromAPI(api);

// Resultado:
// [
//   {
//     name: 'api_crm_api_getcustomers',
//     description: 'Obtiene lista de clientes - API: API de gestión de clientes',
//     parameters: { type: 'object', properties: {}, required: [] }
//   },
//   {
//     name: 'api_crm_api_createcustomer',
//     description: 'Crea un nuevo cliente - API: API de gestión de clientes',
//     parameters: {
//       type: 'object',
//       properties: {
//         name: { type: 'string', description: 'Nombre del cliente' },
//         email: { type: 'string', description: 'Email del cliente' }
//       },
//       required: ['name', 'email']
//     }
//   }
// ]
```

### Nombres de Tools

Los nombres se generan siguiendo el patrón:
```
api_{api_id}_{endpoint_name}
```

Ejemplos:
- `api_crm_api_getcustomers`
- `api_inventory_api_getstock`
- `api_payment_api_createcharge`

## 🚀 Ejecución de Llamadas

### Ejecución Básica

```typescript
import { apiExecutor } from './src/enterprise/api-executor.js';

const api = dynamicAPIManager.getAPI('crm-api');

const result = await apiExecutor.executeByEndpointName(
  api,
  'getCustomers',
  {} // parámetros
);

if (result.success) {
  console.log('Datos:', result.data);
} else {
  console.error('Error:', result.error);
}
```

### Con Parámetros

```typescript
const result = await apiExecutor.executeByEndpointName(
  api,
  'createCustomer',
  {
    name: 'Juan Pérez',
    email: 'juan@example.com'
  }
);
```

### Con Configuración Personalizada

```typescript
const result = await apiExecutor.executeByEndpointName(
  api,
  'getCustomers',
  {},
  {
    maxRetries: 5,
    retryDelayMs: 2000,
    timeoutMs: 60000
  }
);
```

### Manejo de Errores

```typescript
const result = await apiExecutor.executeByEndpointName(api, 'getCustomers');

if (!result.success) {
  console.error(`Error: ${result.error}`);
  console.error(`Status Code: ${result.statusCode}`);
  console.error(`Response Time: ${result.responseTime}ms`);
}
```

## 💡 Ejemplos Prácticos

### Ejemplo 1: API de CRM

```json
{
  "id": "hubspot-api",
  "name": "HubSpot CRM",
  "baseUrl": "https://api.hubapi.com",
  "auth": {
    "type": "bearer",
    "bearerToken": "pat-na1-..."
  },
  "endpoints": [
    {
      "name": "getContacts",
      "path": "/crm/v3/objects/contacts",
      "method": "GET"
    },
    {
      "name": "createContact",
      "path": "/crm/v3/objects/contacts",
      "method": "POST",
      "parameters": [
        {
          "name": "properties",
          "type": "object",
          "required": true,
          "description": "Propiedades del contacto"
        }
      ]
    }
  ],
  "tags": ["crm", "sales", "hubspot"]
}
```

### Ejemplo 2: API de Inventario

```json
{
  "id": "inventory-api",
  "name": "Sistema de Inventario",
  "baseUrl": "https://inventory.company.com/api/v1",
  "auth": {
    "type": "api_key",
    "apiKey": "inv_key_123456",
    "apiKeyHeader": "X-Inventory-Key"
  },
  "endpoints": [
    {
      "name": "getStock",
      "path": "/stock",
      "method": "GET"
    },
    {
      "name": "updateStock",
      "path": "/stock/{productId}",
      "method": "PUT",
      "parameters": [
        {
          "name": "productId",
          "type": "string",
          "required": true
        },
        {
          "name": "quantity",
          "type": "number",
          "required": true
        }
      ]
    }
  ],
  "tags": ["inventory", "warehouse"]
}
```

### Ejemplo 3: API de Pagos

```json
{
  "id": "stripe-api",
  "name": "Stripe Payments",
  "baseUrl": "https://api.stripe.com/v1",
  "auth": {
    "type": "bearer",
    "bearerToken": "sk_test_..."
  },
  "endpoints": [
    {
      "name": "createCharge",
      "path": "/charges",
      "method": "POST",
      "parameters": [
        {
          "name": "amount",
          "type": "number",
          "required": true,
          "description": "Monto en centavos"
        },
        {
          "name": "currency",
          "type": "string",
          "required": true,
          "description": "Código de moneda (USD, EUR, etc.)"
        },
        {
          "name": "source",
          "type": "string",
          "required": true,
          "description": "Token de tarjeta"
        }
      ]
    }
  ],
  "tags": ["payments", "stripe"]
}
```

## 🔍 Troubleshooting

### Error: "API with ID already exists"

**Causa**: Intentas registrar una API con un ID que ya existe.

**Solución**:
```typescript
// Elimina la API existente primero
dynamicAPIManager.deleteAPI('existing-id');
// O usa un ID diferente
```

### Error: "Endpoint not found"

**Causa**: El nombre del endpoint no coincide con ninguno registrado.

**Solución**:
```typescript
const api = dynamicAPIManager.getAPI('api-id');
console.log('Endpoints disponibles:', api.endpoints.map(e => e.name));
```

### Error: "Invalid API config"

**Causa**: La configuración de la API tiene errores de validación.

**Solución**:
```typescript
const validation = dynamicAPIManager.validateConfig(apiConfig);
if (!validation.valid) {
  console.error('Errores:', validation.errors);
}
```

### Timeout en Llamadas

**Causa**: La API tarda demasiado en responder.

**Solución**:
```typescript
// Aumenta el timeout
const result = await apiExecutor.executeByEndpointName(
  api,
  'slowEndpoint',
  {},
  { timeoutMs: 120000 } // 2 minutos
);
```

### Errores 429 (Too Many Requests)

**Causa**: Límite de rate limiting de la API.

**Solución**: El sistema reintenta automáticamente con backoff exponencial.
```typescript
// Aumenta reintentos y delay
const result = await apiExecutor.executeByEndpointName(
  api,
  'endpoint',
  {},
  {
    maxRetries: 5,
    retryDelayMs: 3000
  }
);
```

## 📊 Mejores Prácticas

### 1. Usa Tags para Organización

```json
{
  "tags": ["crm", "sales", "production"]
}
```

Permite buscar APIs fácilmente:
```typescript
const crmAPIs = dynamicAPIManager.findByTags(['crm']);
```

### 2. Documenta tus Endpoints

```json
{
  "name": "createCustomer",
  "description": "Crea un nuevo cliente en el CRM. Requiere nombre y email.",
  "parameters": [
    {
      "name": "name",
      "description": "Nombre completo del cliente (mínimo 2 caracteres)"
    }
  ]
}
```

### 3. Maneja Errores Apropiadamente

```typescript
try {
  const result = await apiExecutor.executeByEndpointName(api, 'endpoint');
  
  if (!result.success) {
    // Log del error
    logger.error(`API call failed: ${result.error}`);
    
    // Notificar al usuario
    return `Error al llamar a la API: ${result.error}`;
  }
  
  return result.data;
} catch (error) {
  logger.error('Unexpected error:', error);
  return 'Error inesperado al procesar la solicitud';
}
```

### 4. Usa Configuración de Timeout Apropiada

```json
{
  "timeoutMs": 30000  // 30 segundos para APIs normales
}
```

Para APIs lentas:
```json
{
  "timeoutMs": 120000  // 2 minutos para operaciones pesadas
}
```

### 5. Protege tus Credenciales

❌ **No hagas esto**:
```json
{
  "auth": {
    "type": "bearer",
    "bearerToken": "hardcoded-token-123"
  }
}
```

✅ **Haz esto**:
```typescript
const apiConfig = {
  auth: {
    type: 'bearer',
    bearerToken: process.env.API_TOKEN
  }
};
```

---

**Última actualización**: 2026-02-12  
**Versión**: 1.0  
**Autor**: OpenClaw Team
