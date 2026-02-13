# 🎭 Simulacro Completo: Wizard Empresarial

## Comando inicial

```bash
E:\openclaw-main> node openclaw.mjs enterprise setup
```

---

## CASO A: Sin pre-requisitos (primera vez)

```
🦞 OpenClaw 2026.2.10
   Bienvenido a la línea de comandos: donde los sueños compilan 
   y la confianza hace segfault.

🏪 OpenClaw Empresarial

⚠️  NO SE DETECTARON CANALES CONFIGURADOS

Este wizard es COMPLEMENTARIO. Primero debes ejecutar:

  openclaw onboard

Esto configurará:
  • Modelo LLM (Claude/OpenAI)
  • Token de Telegram (@BotFather)  
  • WhatsApp principal (escanear QR)
  • Credenciales de canales

Una vez completado, vuelve a ejecutar:
  openclaw enterprise setup

Presiona Enter para salir...
```

**Resultado:** Sale del wizard. El usuario debe ejecutar `openclaw onboard` primero.

---

## CASO B: Con pre-requisitos (flujo normal)

### 0️⃣ Introducción

```
🦞 OpenClaw 2026.2.10
   Bienvenido a la línea de comandos: donde los sueños compilan 
   y la confianza hace segfault.

🏪 OpenClaw Empresarial

✅ PRE-REQUISITOS DETECTADOS:
   
   [✓] Modelo LLM: anthropic/claude-opus-4-6
   [✓] Telegram: Configurado (@MiBot)
   [✓] WhatsApp principal: +5491112345678 (conectado)
   
   Todo listo para configurar el modo empresarial.

Presiona Enter para continuar...
```

---

### 1️⃣ Paso 1: Información del Negocio

```
┌─────────────────────────────────────────┐
│  PASO 1 DE 4: Información del Negocio   │
└─────────────────────────────────────────┘

Esta información personalizará las respuestas del asistente.

? Nombre del negocio › 
  [Escribir: Mi Empresa S.A.]

? Tipo de negocio › 
  ○ Retail / Tienda
    Venta de productos físicos
  
  ○ Servicios
    Servicios profesionales
  
  ◉ Consultoría
    Asesoramiento especializado
  
  ○ Salud
    Médico / Dental / Bienestar
  
  ○ Educación
    Cursos / Tutoriales / Capacitación
  
  ○ Otro
    Otro tipo de negocio
  
  [Flechas para mover, Enter para seleccionar]

? ¿Qué hace tu negocio? (descripción breve) › 
  [Escribir: Consultoría en transformación digital para pymes]
  
  💡 Esta descripción ayudará al asistente a entender 
     cómo presentar tu negocio.
```

**Respuestas ejemplo:**
- Nombre: `Consultora Finanzas Digital`
- Tipo: `Consultoría`
- Descripción: `Ayudamos a pymes a digitalizar sus procesos financieros`

---

### 2️⃣ Paso 2: Personalidad VENTAS

```
┌─────────────────────────────────────────┐
│  PASO 2 DE 4: Personalidad VENTAS       │
└─────────────────────────────────────────┘

📱 CANAL: WhatsApp (público)
🎯 FUNCIÓN: Atención a clientes
⚠️  RESTRICCIONES: Sin comandos de sistema

Esta personalidad interactúa con clientes externos.
Tiene acceso LIMITADO y escala al admin automáticamente 
cuando detecta algo fuera de su expertise.

─────────────────────────────────────────

? Nombre del asistente de ventas › 
  [Escribir: Ana]
  
  💡 Este nombre verán tus clientes.

? Tono de comunicación › 
  ○ Profesional
    Formal, corporativo, directo
  
  ◉ Amigable
    Cálido pero manteniendo profesionalismo
  
  ○ Casual  
    Relajado, cercano, informal
  
  ○ Lujo
    Exclusivo, sofisticado, elegante

? ¿Personalizar áreas de expertise? › Sí / No

Si selecciona SÍ:

? Selecciona las áreas de expertise (Espacio para marcar, Enter para confirmar)
  
  ◉ Agendar consultas iniciales
  ◉ Informar metodologías y servicios
  ◉ Cotizar proyectos
  ◉ Enviar propuestas comerciales
  ○ Gestionar facturación
  ○ Consultar estado de proyectos activos
  
  [Espacio: marcar/desmarcar, Enter: confirmar]
```

**Respuestas ejemplo:**
- Nombre: `Ana`
- Tono: `Amigable`
- Expertise: `Agendar consultas`, `Cotizar proyectos`, `Enviar propuestas`

---

### 3️⃣ Paso 3: Personalidad ADMIN

```
┌─────────────────────────────────────────┐
│  PASO 3 DE 4: Personalidad ADMIN        │
└─────────────────────────────────────────┘

📱 CANAL: Telegram (privado)
🎯 FUNCIÓN: Control total
✅ PERMISOS: Completos

Esta personalidad es para TI (el administrador).
Tiene acceso completo al sistema y recibe alertas de seguridad.

─────────────────────────────────────────

? Nombre del asistente admin › 
  [Escribir: Admin]
  
  💡 Este nombre verás tú en Telegram.

─────────────────────────────────────────

📝 CARACTERÍSTICAS DEL ADMIN:

✓ Acceso a todos los comandos del sistema
✓ Recepción de alertas de seguridad en tiempo real
✓ Capacidad de intervenir conversaciones de ventas
✓ Gestión de agentes y configuración
✓ Escalada automática desde ventas cuando:
  • Cliente solicita algo fuera del expertise
  • Intento de manipulación detectado
  • Solicitud de hablar con humano
  • Problema técnico complejo
```

**Respuesta ejemplo:**
- Nombre: `Admin` (o `Jefe`, `Supervisor`, etc.)

---

### 4️⃣ Paso 4: Cuentas WhatsApp

```
┌─────────────────────────────────────────┐
│  PASO 4 DE 4: Cuentas WhatsApp          │
└─────────────────────────────────────────┘

Puedes configurar múltiples cuentas de WhatsApp
para diferentes funciones de tu negocio.

─────────────────────────────────────────

📱 CUENTA PRINCIPAL (obligatoria)

? Número de WhatsApp VENTAS (con código de país) › 
  [Escribir: +5491112345678]
  
  💡 Incluir el '+' y código de país (ej: +54 para Argentina)
     Esta es la cuenta principal de atención al público.

─────────────────────────────────────────

? ¿Agregar cuenta adicional de WhatsApp? › Sí / No

Si SÍ:

? Tipo de cuenta › 
  ◉ COMPRAS
    Gestión de proveedores y stock
  
  ○ SOPORTE
    Atención post-venta y técnicos
  
  ○ VIP
    Clientes premium exclusivos

? Número de WhatsApp COMPRAS › 
  [Escribir: +5491187654321]

─────────────────────────────────────────

? ¿Agregar otra cuenta? › Sí / No

Si SÍ (otra cuenta):

? Tipo de cuenta › 
  ○ COMPRAS
  ◉ SOPORTE
  ○ VIP

? Número de WhatsApp SOPORTE › 
  [Escribir: +5491198765432]

─────────────────────────────────────────

? ¿Agregar otra cuenta? › Sí / No

Si NO:
```

**Configuración ejemplo:**
- VENTAS: `+5491112345678` (ya estaba configurado)
- COMPRAS: `+5491187654321` (nueva)
- SOPORTE: `+5491198765432` (nueva)

---

### 5️⃣ Resumen y Confirmación

```
┌─────────────────────────────────────────┐
│           RESUMEN FINAL                 │
├─────────────────────────────────────────┤
│                                         │
│  🏢 NEGOCIO                             │
│  Nombre: Consultora Finanzas Digital    │
│  Tipo: Consultoría                      │
│                                         │
│  👤 PERSONALIDAD VENTAS (WhatsApp)      │
│  Nombre: Ana                            │
│  Tono: Amigable                         │
│  Canales: WhatsApp público              │
│  Expertise: 3 áreas seleccionadas       │
│  Acceso: Limitado (escala automática)   │
│                                         │
│  👔 PERSONALIDAD ADMIN (Telegram)       │
│  Nombre: Admin                          │
│  Canal: Telegram privado                │
│  Acceso: Completo                       │
│  Alertas: Activadas                     │
│                                         │
│  📱 CUENTAS WHATSAP CONFIGURADAS:       │
│  • VENTAS:   +5491112345678 ✓           │
│  • COMPRAS:  +5491187654321 ⏳ (falta QR)│
│  • SOPORTE:  +5491198765432 ⏳ (falta QR)│
│                                         │
│  ⏳ = Requiere escanear QR              │
│                                         │
└─────────────────────────────────────────┘

? ¿Todo está correcto? Aplicar configuración › Sí / No
```

Si elige **No**:
```
❌ Configuración cancelada.

No se guardaron cambios.
Puedes reiniciar el wizard cuando quieras:
  openclaw enterprise setup
```

Si elige **Sí**:
```
💾 Guardando configuración...

✅ Configuración aplicada correctamente.
```

---

### 6️⃣ Outro - Próximos Pasos

```
┌─────────────────────────────────────────┐
│  ✅ CONFIGURACIÓN EMPRESARIAL COMPLETADA │
└─────────────────────────────────────────┘

Tu asistente empresarial está configurado.
Ahora necesitas completar la activación de canales.

─────────────────────────────────────────

📝 PRÓXIMOS PASOS:

1️⃣ ESCANEAR CÓDIGOS QR

   Cada cuenta de WhatsApp adicional necesita 
   escanear su propio código QR:
   
   📱 COMPRAS (+5491187654321):
      $ openclaw channels login whatsapp --account compras
   
   📱 SOPORTE (+5491198765432):
      $ openclaw channels login whatsapp --account soporte
   
   💡 El QR se mostrará en pantalla. 
      Tienes 60 segundos para escanearlo con tu teléfono.

─────────────────────────────────────────

2️⃣ INICIAR EL GATEWAY

   $ openclaw gateway --port 18789
   
   O en modo desarrollo:
   $ openclaw gateway --port 18789 --verbose

─────────────────────────────────────────

3️⃣ ACCEDER AL PANEL DE ADMIN

   🌐 http://localhost:18789/admin
   
   Desde aquí puedes:
   • Ver estado de canales
   • Configurar APIs adicionales
   • Ver logs de conversaciones
   • Gestionar personalidades

─────────────────────────────────────────

4️⃣ COMANDOS ÚTILES

   Ver estado de canales:
   $ openclaw channels status
   
   Ver configuración empresarial:
   $ openclaw enterprise status
   
   Agregar una API externa:
   $ openclaw enterprise apis add
   
   Testear personalidad de ventas:
   $ openclaw enterprise test-sales
   
   Ver alertas de seguridad:
   $ openclaw security alerts

─────────────────────────────────────────

📚 DOCUMENTACIÓN:
   • Guía rápida: https://docs.openclaw.ai/quickstart
   • Seguridad: https://docs.openclaw.ai/security
   • APIs: https://docs.openclaw.ai/enterprise-apis

💬 SOPORTE:
   • Discord: https://discord.gg/clawd
   • GitHub Issues: https://github.com/openclaw/openclaw

─────────────────────────────────────────

🦞 ¡OpenClaw Empresarial está listo!
   Exfoliate! Exfoliate!

Presiona Enter para salir...
```

---

## 🔄 Flujo completo visual

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Usuario   │────▶│  openclaw       │────▶│  openclaw       │
│   inicia    │     │  onboard        │     │  enterprise     │
│   terminal  │     │  (primero)      │     │  setup          │
└─────────────┘     └─────────────────┘     └─────────────────┘
                           │                         │
                           ▼                         ▼
                    ┌─────────────┐           ┌─────────────┐
                    │ Configura:  │           │ Configura:  │
                    │ • Modelo LLM│           │ • Negocio   │
                    │ • Telegram  │           │ • Ventas    │
                    │ • WhatsApp  │           │ • Admin     │
                    │ • Gateway   │           │ • Multi-WA  │
                    └─────────────┘           └─────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────┐
                                               │ Escanear QR │
                                               │ cuentas     │
                                               │ adicionales │
                                               └─────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────┐
                                               │ Iniciar     │
                                               │ Gateway     │
                                               └─────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────┐
                                               │ 🎉 Listo!   │
                                               └─────────────┘
```

---

## 📝 Notas de diseño

### Decisiones de UX:

1. **Pre-requisitos primero**: El wizard no avanza si no hay canales base
2. **Pasos numerados**: 4 pasos claros para no abrumar
3. **Defaults inteligentes**: Sugiere expertise según tipo de negocio
4. **Multiselect**: Checkboxes para expertise (no texto libre)
5. **Resumen visual**: Tabla clara antes de confirmar
6. **Próximos pasos detallados**: No deja al usuario "colgado"

### Seguridad:

- Ventas: Acceso limitado, sandboxed
- Admin: Acceso completo por Telegram privado
- Escalada automática: Ventas → Admin cuando es necesario

### WhatsApp Multi-cuenta:

- VENTAS: Obligatoria, atención pública
- COMPRAS: Opcional, proveedores
- SOPORTE: Opcional, post-venta
- VIP: Opcional, clientes premium

---

*Documento creado para estudio y referencia*
*Fecha: 2026-02-13*
