# 🦞 Wizard Unificado: Onboard + Empresarial

Este documento describe el flujo completo unificado.
El usuario percibe UN SOLO WIZARD, pero internamente son dos.

---

# PARTE 1: CONFIGURACIÓN BÁSICA (Internamente: onboard)

## Comando inicial

```bash
E:\openclaw-main> openclaw onboard

🦞 OpenClaw 2026.2.10
   Bienvenido a la línea de comandos: donde los sueños compilan 
   y la confianza hace segfault.

🚀 Configuración de OpenClaw

Este asistente configurará tu asistente de IA paso a paso.
```

---

## 0️⃣ Advertencia de Seguridad

```
┌─────────────────────────────────────────┐
│  ⚠️  ADVERTENCIA DE SEGURIDAD           │
└─────────────────────────────────────────┘

OpenClaw es un proyecto en desarrollo (beta).
Este bot puede leer archivos y ejecutar acciones.

Línea base recomendada:
• Pairing/allowlists + mention gating
• Sandbox + herramientas de mínimo privilegio
• No guardar secretos en archivos accesibles

Documentación: https://docs.openclaw.ai/gateway/security

? ¿Entiendes los riesgos y quieres continuar? › Sí / No
```

---

## 1️⃣ Modo de Configuración

```
? Modo de configuración › 
  ◉ QuickStart
    Configuración rápida recomendada.
    Ajustar detalles avanzados luego.
  
  ○ Manual
    Configurar cada opción paso a paso.
```

---

## 2️⃣ Proveedor de IA (LLM)

```
┌─────────────────────────────────────────┐
│  CONFIGURACIÓN DE MODELO DE IA          │
└─────────────────────────────────────────┘

Selecciona el proveedor de IA para tu asistente:

? Proveedor de IA › 
  
  🇺🇸 PROVEEDORES ESTADOUNIDENSES
  ◉ Anthropic (Claude)
    Recomendado. Mejor calidad y seguridad.
    Modelos: Claude Opus 4.6, Sonnet 4.6, Haiku 3.5
  
  ○ OpenAI (GPT/Codex)
    GPT-4, o1, Codex. Buena calidad.
  
  ○ xAI (Grok)
    Modelos Grok. Enfoque en libertad de expresión.
  
  ○ Google (Gemini)
    Gemini Pro/Flash. Integración con Google.
  
  🇨🇳 PROVEEDORES CHINOS
  ○ Moonshot AI (Kimi K2.5)
    Excelente para coding y razonamiento.
    Modelos: Kimi K2.5, Kimi Code
  
  ○ Z.AI (GLM 4.7)
    Modelo GLM de alta calidad.
    Buen rendimiento en español.
  
  ○ DeepSeek (via Together AI)
    Modelo open-source muy capaz.
    Especializado en código y matemáticas.
  
  ○ Qwen (Alibaba)
    Modelo Qwen 2.5. Multilingüe.
  
  ○ MiniMax (M2.1)
    Modelo chino con buen rendimiento.
  
  ○ Qianfan (Baidu)
    Modelos de Baidu.
  
  🌐 OTROS / PERSONALIZADO
  ○ OpenRouter
    Acceso a múltiples modelos (incluidos chinos)
  
  ○ Together AI
    Llama, DeepSeek, Qwen y más open models
  
  ○ Custom Provider
    Cualquier endpoint compatible OpenAI/Anthropic

─────────────────────────────────────────

[Si selecciona Anthropic u OpenAI con OAuth]

🔐 Abriendo navegador para autenticación...
   Inicia sesión con tu cuenta.
   Esperando autorización...

✅ Autenticación exitosa!

[Si selecciona proveedor chino con API Key]

? Ingresa tu API Key › 
  [Input oculto]
  
  ✅ API Key válida!

? Modelo por defecto › 
  [Muestra modelos disponibles del proveedor seleccionado]
```

---

## 3️⃣ Configuración del Gateway

```
┌─────────────────────────────────────────┐
│  CONFIGURACIÓN DEL GATEWAY              │
└─────────────────────────────────────────┘

El gateway es el centro de control de OpenClaw.
Aquí se conectan los canales y se gestionan las sesiones.

? Puerto del gateway › 
  [18789] (default)
  
  💡 El panel estará en http://localhost:18789

? Modo de red › 
  ◉ Loopback (localhost)
    Solo desde esta computadora. Más seguro.
  
  ○ LAN (red local)
    Desde otros dispositivos de la red.
  
  ○ Tailscale (acceso remoto)
    Desde cualquier lugar vía Tailscale VPN.

─────────────────────────────────────────

? Autenticación para el panel de administración › 
  ◉ Token seguro (generado automáticamente)
    Se usará para acceder al panel web.
  
  ○ Password personalizada
    Elegir tu propia contraseña.
  
  ○ Sin auth (solo loopback)
    Solo para desarrollo local.

💡 Esta autenticación protege el panel de administración
   donde podrás ver conversaciones, configurar APIs,
   y gestionar el sistema.

? ¿Instalar como servicio del sistema? › Sí / No
  
  💡 Inicia automáticamente al encender la computadora.
     [Disponible en macOS/Linux con systemd/launchd]
```

---

## 4️⃣ Configuración de Canales

### 4A. Telegram (OBLIGATORIO - Canal Admin)

```
┌─────────────────────────────────────────┐
│  📱 TELEGRAM - CANAL ADMIN (OBLIGATORIO)│
└─────────────────────────────────────────┘

⚠️  Telegram es OBLIGATORIO y será tu canal de ADMINISTRADOR.

🔑 FUNCIÓN DE ADMIN:
• Recibir alertas de seguridad en tiempo real
• Acceso completo a todos los comandos
• Capacidad de intervenir conversaciones
• Gestión completa del sistema
• Escaladas automáticas desde otros canales

🔒 SEGURIDAD:
• Canal PRIVADO (solo tú)
• Acceso total al sistema
• Notificaciones de intentos de manipulación
• Control de otros agentes

⚠️ IMPORTANTE: Usa Telegram SOLO TÚ para administrar.
   Los clientes usarán WhatsApp u otros canales.

─────────────────────────────────────────┐

? ¿Ya tienes un bot de Telegram? › Sí / No

Si NO:
┌─────────────────────────────────────────┐
│  CREAR BOT DE TELEGRAM                  │
├─────────────────────────────────────────┤
│                                         │
│  1. Abre Telegram                       │
│  2. Busca @BotFather                    │
│  3. Envía /newbot                       │
│  4. Elige nombre y username             │
│  5. Copia el token que te da            │
│                                         │
│  El token tiene este formato:           │
│  123456789:ABCdefGHIjklMNOpqrSTUvwxyz   │
│                                         │
└─────────────────────────────────────────┘

? Token de tu bot de Telegram › 
  [Escribir: 123456789:ABCdefGHIjklMNOpqrSTUvwxyz]
  
  ✅ Token válido!
  Bot: @MiOpenClawBot

? Tu ID de usuario de Telegram › 
  [Escribir: @miusuario o 123456789]
  
  💡 Obtén tu ID con @userinfobot
     Esto te dará acceso inmediato sin emparejamiento.

✅ Telegram configurado como canal ADMIN
```

### 4B. WhatsApp (Canal Ventas - Principal)

```
┌─────────────────────────────────────────┐
│  💬 WHATSAPP - CANAL VENTAS (PRINCIPAL) │
└─────────────────────────────────────────┘

WhatsApp será el canal principal para ATENCIÓN AL PÚBLICO.
Los clientes te contactarán aquí.

🔑 FUNCIÓN DE VENTAS:
• Atención a clientes
• Consultas de productos/servicios
• Cotizaciones
• Acceso limitado (escala a admin cuando es necesario)

⚠️ SEGURIDAD:
• Acceso restringido (sin comandos de sistema)
• Sandbox para operaciones
• Escalada automática a Telegram si es necesario

─────────────────────────────────────────

? Número de teléfono de WhatsApp (con código de país) › 
  [Escribir: +5491112345678]

🔄 Generando código QR...

┌─────────────────────────────────────────┐
│                                         │
│  [CÓDIGO QR AQUÍ]                      │
│                                         │
│  📱 Escanea con WhatsApp:              │
│     Ajustes → Dispositivos vinculados   │
│     → Vincular dispositivo             │
│                                         │
│  ⏱️  Tiempo restante: 60 segundos...    │
│                                         │
└─────────────────────────────────────────┘

✅ WhatsApp conectado!
   Número: +5491112345678
   Función: VENTAS (atención al público)
```

### 4C. WhatsApp Adicionales (Otras funciones)

```
┌─────────────────────────────────────────┐
│  ¿AGREGAR MÁS CUENTAS DE WHATSAPP?      │
└─────────────────────────────────────────┘

Puedes configurar múltiples números de WhatsApp
para diferentes funciones de tu negocio:

? ¿Cuántas cuentas adicionales quieres agregar? › 
  ◉ 0 (solo la cuenta de ventas)
  ○ 1 cuenta adicional
  ○ 2 cuentas adicionales
  ○ 3 cuentas adicionales
  ○ 4 o más

─────────────────────────────────────────

Si selecciona 1 o más:

? Cuenta adicional #1 - ¿Qué función tendrá? › 
  ◉ SOPORTE TÉCNICO
    Atención post-venta, troubleshooting, garantías
    Público: clientes con problemas técnicos
  
  ○ COMPRAS / PROVEEDORES
    Gestión de proveedores, órdenes de compra
    Privado: solo tú y proveedores
  
  ○ RESERVAS / TURNOS
    Agendamiento de citas, turnos, reservas
    Público: clientes que quieren agendar
  
  ○ FACTURACIÓN / PAGOS
    Consultas de facturas, pagos, cotizaciones
    Público: clientes con consultas administrativas
  
  ○ PERSONALIZADO
    Definir función personalizada

? Número de teléfono para SOPORTE › 
  [Escribir: +5491198765432]

🔄 Generando código QR para SOPORTE...

✅ WhatsApp SOPORTE conectado!
   Número: +5491198765432
   Función: SOPORTE TÉCNICO

─────────────────────────────────────────

[Repetir para cada cuenta adicional solicitada]

📊 RESUMEN DE CUENTAS WHATSAPP:
   ✅ VENTAS:    +5491112345678 (principal)
   ✅ SOPORTE:   +5491198765432
   ⏳ COMPRAS:   +5491187654321 (esperando QR)
   
   Cada una con su propio código QR.
```

### 4D. Otros Canales (Soporte/Adicionales)

```
┌─────────────────────────────────────────┐
│  OTROS CANALES DE SOPORTE               │
└─────────────────────────────────────────┘

Estos canales son opcionales y se usarán para SOPORTE
(no para atención al público principal).

? ¿Quieres agregar canales adicionales? › Sí / No

Si SÍ:

? Selecciona los canales a configurar (Espacio para marcar):
  
  ○ 📱 Discord
    Para comunidades y soporte grupal
    
  ○ 💼 Slack
    Para equipos internos
    
  ○ 💬 Google Chat
    Para integración con Google Workspace
    
  ○ 📶 Signal
    Comunicación segura y privada
    
  ○ 🍎 iMessage
    Solo disponible en macOS

💡 Estos canales se configurarán con acceso de SOPORTE
   (no atención al público principal).

[Configurar cada canal seleccionado...]
```

---

## 5️⃣ Workspace

```
┌─────────────────────────────────────────┐
│  CONFIGURACIÓN DE WORKSPACE             │
└─────────────────────────────────────────┘

El workspace es donde OpenClaw guarda:
• Historiales de conversación
• Configuración de agentes
• Archivos temporales

? Ubicación del workspace › 
  [C:\Users\Usuario\.openclaw\workspace]
  
? ¿Crear directorio de sesiones? › Sí

✅ Workspace configurado.
```

---

# PARTE 2: CONFIGURACIÓN EMPRESARIAL (Flujo automático)

*El usuario no ve que cambió de wizard. Continúa fluido.*

```
┌─────────────────────────────────────────┐
│  🏪 CONFIGURACIÓN EMPRESARIAL           │
└─────────────────────────────────────────┘

Ahora configuraremos las personalidades de tu asistente
para diferentes funciones de tu negocio.

Presiona Enter para continuar...
```

---

## 6️⃣ Información del Negocio

```
┌─────────────────────────────────────────┐
│  INFORMACIÓN DE TU NEGOCIO              │
└─────────────────────────────────────────┘

? Nombre del negocio › 
  [Escribir: Consultora Finanzas Digital]

? Tipo de negocio › 
  ◉ Consultoría
  ○ Retail / Tienda
  ○ Servicios
  ○ Salud
  ○ Educación
  ○ Otro

? ¿Qué hace tu negocio? › 
  [Escribir: Ayudamos a pymes a digitalizar sus procesos financieros]
```

---

## 7️⃣ Personalidad VENTAS (WhatsApp)

```
┌─────────────────────────────────────────┐
│  PERSONALIDAD PARA VENTAS               │
└─────────────────────────────────────────┘

Esta personalidad atiende a clientes por WhatsApp.
Canal: WhatsApp (+5491112345678)

? Nombre del asistente de ventas › 
  [Escribir: Ana]

? Tono de comunicación › 
  ◉ Amigable
  ○ Profesional
  ○ Casual
  ○ Lujo

? Áreas de expertise (Espacio para marcar):
  
  ◉ Agendar consultas iniciales
  ◉ Informar metodologías
  ◉ Cotizar proyectos
  ◉ Enviar propuestas
  ○ Gestionar facturación
  ○ Soporte técnico
```

---

## 8️⃣ Personalidad SOPORTE (WhatsApp adicional)

```
[SOLO SI CONFIGURÓ WHATSAPP ADICIONAL]

┌─────────────────────────────────────────┐
│  PERSONALIDAD PARA SOPORTE              │
└─────────────────────────────────────────┘

Canal: WhatsApp SOPORTE (+5491198765432)

? Nombre del asistente de soporte › 
  [Escribir: Técnico]

? Especialidad › 
  ◉ Soporte técnico general
  ○ Resolución de problemas
  ○ Garantías y devoluciones
  ○ Consultas post-venta
```

---

## 9️⃣ Personalidad ADMIN (Telegram)

```
┌─────────────────────────────────────────┐
│  PERSONALIDAD PARA ADMIN                │
└─────────────────────────────────────────┘

Canal: Telegram (@MiOpenClawBot)
Acceso: Solo tú (administrador total)

? Nombre del asistente admin › 
  [Escribir: Jefe]

🔒 CARACTERÍSTICAS DEL ADMIN:

✓ Acceso completo al sistema
✓ Recibe alertas de seguridad
✓ Puede intervenir conversaciones de ventas/soporte
✓ Gestiona configuración global
✓ Escalada automática desde otros canales

✅ Admin configurado.
```

---

# RESUMEN FINAL UNIFICADO

```
┌─────────────────────────────────────────┐
│  ✅ CONFIGURACIÓN COMPLETADA            │
├─────────────────────────────────────────┤
│                                         │
│  🤖 MODELO DE IA                        │
│  Proveedor: Anthropic Claude Opus 4.6   │
│                                         │
│  🌐 GATEWAY                             │
│  Puerto: 18789                          │
│  Panel: http://localhost:18789/admin    │
│  Auth: Token seguro                     │
│                                         │
│  👔 CANAL ADMIN (Telegram)              │
│  Bot: @MiOpenClawBot                    │
│  Nombre: Jefe                           │
│  Acceso: Completo                       │
│                                         │
│  📱 CANALES DE VENTAS Y SOPORTE         │
│  • VENTAS:    +5491112345678 (Ana)      │
│  • SOPORTE:   +5491198765432 (Técnico)  │
│                                         │
│  🏢 NEGOCIO                             │
│  Nombre: Consultora Finanzas Digital    │
│  Tipo: Consultoría                      │
│                                         │
│  🎯 PERSONALIDADES CONFIGURADAS         │
│  • VENTAS: Ana (Amigable)               │
│  • SOPORTE: Técnico                     │
│  • ADMIN: Jefe                          │
│                                         │
│  ✨ FUNCIONES ACTIVADAS                 │
│  • Dual Personality                     │
│  • Escalada automática                  │
│  • Alertas de seguridad                 │
│                                         │
└─────────────────────────────────────────┘

🚀 PRÓXIMOS PASOS:

1. INICIAR EL SISTEMA:
   $ openclaw gateway --port 18789

2. PROBAR LOS CANALES:
   • Telegram: Escribe a @MiOpenClawBot (como admin)
   • WhatsApp Ventas: Escribe a +5491112345678 (como cliente)
   • WhatsApp Soporte: Escribe a +5491198765432 (como cliente)

3. PANEL DE ADMINISTRACIÓN:
   http://localhost:18789/admin

4. COMANDOS ÚTILES:
   $ openclaw channels status
   $ openclaw enterprise status
   $ openclaw enterprise apis add

📚 Documentación: https://docs.openclaw.ai
💬 Soporte: https://discord.gg/clawd

🦞 ¡OpenClaw está listo!
   Exfoliate! Exfoliate!

Presiona Enter para salir...
```

---

# DIAGRAMA DE FLUJO UNIFICADO

```
USUARIO EJECUTA:
openclaw onboard
       │
       ▼
┌─────────────────────────────────────────┐
│  PARTE 1: CONFIGURACIÓN BÁSICA          │
│  (Internamente: onboard)                │
├─────────────────────────────────────────┤
│                                         │
│  0. Advertencia de seguridad            │
│  1. Modo (QuickStart/Manual)            │
│  2. LLM (Anthropic/OpenAI/             │
│     Chinos: Kimi/GLM/DeepSeek/etc)      │
│  3. Gateway (puerto, auth, red)         │
│  4A. Telegram (OBLIGATORIO - Admin)     │
│  4B. WhatsApp Ventas (Principal)        │
│  4C. WhatsApp Adicionales (Opcional)    │
│       • Pregunta cuántos                │
│       • Genera QRs dinámicamente        │
│  4D. Otros canales (Soporte)            │
│  5. Workspace                           │
│                                         │
└─────────────────────────────────────────┘
       │
       │ (Automático, sin que el usuario note)
       ▼
┌─────────────────────────────────────────┐
│  PARTE 2: CONFIGURACIÓN EMPRESARIAL     │
│  (Internamente: enterprise)             │
├─────────────────────────────────────────┤
│                                         │
│  6. Info del negocio                    │
│  7. Personalidad VENTAS (WhatsApp)      │
│  8. Personalidad SOPORTE (si aplica)    │
│  9. Personalidad ADMIN (Telegram)       │
│                                         │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  RESUMEN UNIFICADO FINAL                │
│  Muestra TODO junto                     │
└─────────────────────────────────────────┘
       │
       ▼
    🎉 LISTO
```

---

# CAMBIOS CLAVE RESPECTO AL FLUJO ORIGINAL

| Aspecto | Antes | Ahora (Unificado) |
|---------|-------|-------------------|
| **LLMs** | Solo Anthropic/OpenAI/Google | + Chinos: Kimi, GLM, DeepSeek, Qwen, MiniMax |
| **Telegram** | Opcional | **OBLIGATORIO** (canal admin) |
| **WhatsApp** | Solo 1 cuenta | **Múltiples**: Ventas + X adicionales |
| **Discord/Slack** | Canales públicos | **Soporte** (no ventas) |
| **Flujo** | Dos comandos separados | **Un solo flujo** continuo |
| **Resumen** | Dos resúmenes separados | **Un solo resumen** al final |
| **Skills** | Paso 7 en onboard | **Removido**, integrado en empresarial |

---

*Documento de diseño del wizard unificado*
*Fecha: 2026-02-13*
