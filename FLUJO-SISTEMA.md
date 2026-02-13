# Flujo del Sistema OpenClaw - Atención al Cliente Empresarial

## 🎯 Concepto Principal

**NO es un asistente personal tipo ChatGPT**

**SÍ es un agente de ventas/atención para TU negocio específico**

---

## 🔄 Flujo de Conversación

### Ejemplo 1: Cliente pregunta por un producto (✅ Permitido)

```
📱 WhatsApp (Cliente)
"Hola, ¿tienen arroz?"

         ↓
         
🤖 OpenClaw Gateway
Detecta: Canal = WhatsApp → Rol = PUBLIC

         ↓
         
🔒 Tool Access Filter
¿Puede usar "api_check_stock"? → SÍ ✅
(Está en la lista de APIs permitidas)

         ↓
         
🔌 API Empresarial
Consulta: GET /v1/stock?producto=arroz
Respuesta: { disponible: true, cantidad: 50, precio: 2.50 }

         ↓
         
🤖 Agente IA
Formulate respuesta amable:
"¡Sí! Tenemos arroz disponible. 
Precio: $2.50 por kg.
¿Cuántos kilos necesitas?"

         ↓
         
📱 WhatsApp (Cliente recibe)
"¡Sí! Tenemos arroz disponible..."
```

---

### Ejemplo 2: Cliente pregunta algo general (❌ Bloqueado)

```
📱 WhatsApp (Cliente)
"¿Qué hora es en Japón?"

         ↓
         
🤖 OpenClaw Gateway
Detecta: Canal = WhatsApp → Rol = PUBLIC

         ↓
         
🔒 Tool Access Filter
¿Puede usar "search_web"? → NO ❌
¿Puede usar "api_*" para esto? → NO ❌

         ↓
         
🤖 Agente IA (sin herramientas)
System Prompt le dice:
"Solo puedes ayudar con productos y pedidos"

Respuesta:
"Lo siento, solo puedo ayudarte con consultas sobre 
nuestros productos y pedidos. ¿Te gustaría ver 
nuestro catálogo de productos?"

         ↓
         
📱 WhatsApp (Cliente recibe)
"Lo siento, solo puedo ayudarte..."
```

---

### Ejemplo 3: Superadmin ejecuta comando crítico (⚠️ Con Aprobación)

```
💬 Telegram (Superadmin/Tú)
"Elimina el archivo old-data.csv"

         ↓
         
🤖 OpenClaw Gateway
Detecta: Canal = Telegram → Rol = SUPERADMIN

         ↓
         
🔒 Root Authorization
¿Es operación crítica? → SÍ (file_delete)
Crear solicitud de aprobación:
ID: root_abc123
Operación: file_delete

         ↓
         
📱 Telegram (Tú recibes)
"🔐 Root Authorization Request
 
Operation: file_delete
File: old-data.csv

Reply APPROVE root_abc123 
to confirm"

         ↓
         
💬 Telegram (Tú respondes)
"APPROVE root_abc123"

         ↓
         
✅ Operación ejecutada
Archivo eliminado
```

---

## 📊 Comparativa de Permisos

| Acción | Telegram (Tú) | WhatsApp (Cliente) |
|--------|---------------|-------------------|
| **Consultar stock** | ✅ | ✅ |
| **Ver precios** | ✅ | ✅ |
| **Crear pedido** | ✅ | ✅ |
| **Ver catálogo** | ✅ | ✅ |
| **Buscar en Google** | ✅ | ❌ |
| "¿Qué hora es?" | ✅ (responde) | ❌ (rechaza) |
| "¿Clima de hoy?" | ✅ (responde) | ❌ (rechaza) |
| **Borrar archivos** | ✅ (con aprobación) | ❌ |
| **Ver logs del sistema** | ✅ | ❌ |
| **Modificar configuración** | ✅ | ❌ |
| **Ejecutar comandos bash** | ✅ (con aprobación) | ❌ |

---

## 🔧 APIs Configurables (Ejemplos)

### Para un Almacén/Supermercado:
```typescript
apis: [
  'check_stock',      // ¿Tienes arroz?
  'get_price',        // ¿Cuánto cuesta?
  'view_catalog',     // Muéstrame productos
  'create_order',     // Quiero hacer un pedido
  'check_order_status' // ¿Dónde está mi pedido?
]
```

### Para una Clínica:
```typescript
apis: [
  'view_schedule',    // ¿Qué turnos hay?
  'book_appointment', // Quiero agendar
  'check_medical_history', // Ver historial (autorizado)
  'view_doctors'      // ¿Qué médicos hay?
]
```

### Para un Taller Mecánico:
```typescript
apis: [
  'check_parts',      // ¿Tienen esta pieza?
  'get_service_price', // ¿Cuánto cuesta el service?
  'book_appointment',  // Quiero un turno
  'check_vehicle_status' // ¿Cómo va mi auto?
]
```

---

## 🎛️ Configuración por Tipo de Negocio

```javascript
// Ejemplo: RESTAURANTE
const configRestaurante = {
  enterprise: {
    apis: [
      'view_menu',        // Ver carta
      'check_availability', // Ver mesas disponibles
      'make_reservation',  // Reservar mesa
      'order_delivery',    // Pedir delivery
      'check_order_status' // Estado del pedido
    ]
  },
  agentPrompt: "Eres el asistente de DELIVERY PIZZA. Ayudas a: ver el menú, reservar mesas, hacer pedidos de delivery. NO respondes preguntas fuera de estos temas."
};

// Ejemplo: INMOBILIARIA
const configInmobiliaria = {
  enterprise: {
    apis: [
      'search_properties',  // Buscar propiedades
      'schedule_visit',     // Agendar visita
      'get_property_details', // Detalles de propiedad
      'mortgage_calculator'  // Calcular cuota
    ]
  },
  agentPrompt: "Eres el asistente de INMOBILIARIA CASA IDEAL. Ayudas a buscar propiedades, agendar visitas y calcular financiación. NO das consejos generales de inversión."
};
```

---

## 🚫 Qué NUNCA puede hacer un cliente por WhatsApp

1. ❌ Buscar en Google/Wikipedia
2. ❌ Preguntar hora/clima/noticias
3. ❌ Pedir recetas de cocina
4. ❌ Preguntar por temas generales de IA
5. ❌ Ejecutar comandos en tu servidor
6. ❌ Ver archivos de tu sistema
7. ❌ Modificar configuración

---

## ✅ Qué SÍ puede hacer un cliente por WhatsApp

1. ✅ Preguntar por productos de TU negocio
2. ✅ Consultar precios de TU catálogo
3. ✅ Ver disponibilidad/stock
4. ✅ Hacer pedidos
5. ✅ Agendar turnos/citas
6. ✅ Consultar estado de sus pedidos
7. ✅ Ver catálogo de servicios

---

## 🔐 Seguridad en Capas

```
┌─────────────────────────────────────────────┐
│ 1. CHANNEL ROLE                            │
│    Telegram → Superadmin                    │
│    WhatsApp → Public                        │
└─────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────┐
│ 2. TOOL FILTER                             │
│    Public solo ve: api_*, enterprise_*      │
│    Public NO ve: search, bash, file_*      │
└─────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────┐
│ 3. SYSTEM PROMPT                           │
│    "Solo puedes hablar de [tema negocio]"  │
└─────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────┐
│ 4. ROOT AUTHORIZATION (solo superadmin)    │
│    Operaciones críticas requieren aprobación│
└─────────────────────────────────────────────┘
```

---

## 📱 Interfaz Web (Solo para Tú)

El Admin Panel en `http://localhost:18789/admin` te permite:

1. **Ver métricas**: Cuántos mensajes, qué canales están activos
2. **Configurar APIs**: Agregar/quitar APIs empresariales
3. **Ver logs**: Qué preguntan los clientes
4. **Gestionar pedidos**: Ver todos los pedidos del sistema
5. **Configurar respuestas**: Modificar el system prompt

---

**¿Qué tipo de negocio tienes?** Puedo crear una configuración específica para ti.
