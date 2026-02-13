# 🦞 Flujo Completo: Ambos Wizards

Este documento muestra el flujo completo de instalación y configuración.

---

# PARTE 1: WIZARD ORIGINAL (`openclaw onboard`)

## Comando inicial

```bash
E:\openclaw-main> openclaw onboard

🦞 OpenClaw 2026.2.10
   Bienvenido a la línea de comandos: donde los sueños compilan 
   y la confianza hace segfault.

🚀 OpenClaw Onboarding
```

---

## 0️⃣ Advertencia de Seguridad

```
┌─────────────────────────────────────────┐
│  ⚠️  ADVERTENCIA DE SEGURIDAD           │
└─────────────────────────────────────────┘

OpenClaw es un proyecto en desarrollo (beta).
Este bot puede leer archivos y ejecutar acciones si las herramientas
están habilitadas. Un mal prompt puede hacer que haga cosas inseguras.

Si no estás cómodo con seguridad y control de acceso, no ejecutes OpenClaw.
Pide ayuda a alguien con experiencia antes de habilitar herramientas
o exponerlo a internet.

Línea base recomendada:
• Pairing/allowlists + mention gating
• Sandbox + herramientas de mínimo privilegio
• No guardar secretos en archivos accesibles por el agente
• Usar el modelo más fuerte disponible para bots con herramientas

Comandos de seguridad:
  openclaw security audit --deep
  openclaw security audit --fix

Documentación: https://docs.openclaw.ai/gateway/security

? ¿Entiendes que esto es poderoso e inherentemente riesgoso? › Sí / No

[Si elige No: Sale del wizard]
```

---

## 1️⃣ Modo de Onboarding

```
? Modo de onboarding › 
  ◉ QuickStart
    Configuración rápida. Ajustar detalles luego con 
    openclaw configure.
  
  ○ Manual
    Configurar puerto, red, Tailscale y opciones de auth.

[Flechas para mover, Enter para seleccionar]
```

---

## 2️⃣ Configuración de Auth (Modelo LLM)

```
┌─────────────────────────────────────────┐
│  CONFIGURACIÓN DE AUTENTICACIÓN         │
└─────────────────────────────────────────┘

OpenClaw necesita acceso a modelos de IA.
Elige cómo quieres autenticar:

? Proveedor de IA › 
  ◉ Anthropic (Claude)
    Recomendado. Mejor resistencia a inyección de prompts.
  
  ○ OpenAI (GPT/Codex)
    Modelos GPT-4, o1, Codex.
  
  ○ Google (Gemini)
    Modelos Gemini Pro/Flash.
  
  ○ Custom / Otro
    Configurar proveedor personalizado.

─────────────────────────────────────────

Si selecciona Anthropic:

? Método de autenticación › 
  ◉ OAuth (navegador)
    Iniciar sesión con tu cuenta Anthropic.
    Abrirá una ventana del navegador.
  
  ○ API Key
    Ingresar clave de API manualmente.

─────────────────────────────────────────

Si selecciona OAuth:

🔐 Abriendo navegador para autenticación...
   URL: https://console.anthropic.com/oauth/authorize?...
   
   Por favor inicia sesión con tu cuenta Anthropic.
   Esperando autorización...

✅ Autenticación exitosa!
   Perfil: Anthropic Pro (200)
   Modelos disponibles: Claude Opus 4.6, Sonnet 4.6, Haiku 3.5

─────────────────────────────────────────

Si selecciona API Key:

? Ingresa tu API Key de Anthropic › 
  [Input oculto: sk-ant-api03-xxxxxxxxxxxxxxxx]
  
  ✅ API Key válida!
  
? Modelo por defecto › 
  ◉ Claude Opus 4.6
    Mejor calidad, mayor costo
  
  ○ Claude Sonnet 4.6
    Buen balance calidad/costo
  
  ○ Claude Haiku 3.5
    Rápido y económico
```

---

## 3️⃣ Configuración del Gateway

```
┌─────────────────────────────────────────┐
│  CONFIGURACIÓN DEL GATEWAY              │
└─────────────────────────────────────────┘

El gateway es el centro de control de OpenClaw.

? Puerto del gateway › 
  [18789] (default)
  
  💡 El gateway estará disponible en http://localhost:18789

? Modo de red › 
  ◉ Loopback (localhost solo)
    Solo accesible desde esta computadora. Más seguro.
  
  ○ LAN (todos los dispositivos de la red)
    Accesible desde otros dispositivos en la misma red.
  
  ○ Tailscale (recomendado para remoto)
    Acceso seguro desde cualquier lugar vía Tailscale.

? Autenticación del gateway › 
  ◉ Token (recomendado)
    Genera un token seguro automáticamente.
  
  ○ Password
    Elegir una contraseña personalizada.
  
  ○ Sin auth (solo loopback)
    No requiere autenticación (solo para desarrollo local).

─────────────────────────────────────────

? ¿Instalar el gateway como servicio? › Sí / No

  💡 Esto hará que el gateway inicie automáticamente
     al encender la computadora.
     
  [Solo disponible en macOS/Linux con systemd/launchd]
```

---

## 4️⃣ Configuración de Canales

```
┌─────────────────────────────────────────┐
│  CONFIGURACIÓN DE CANALES               │
└─────────────────────────────────────────┘

Selecciona los canales de mensajería que quieres usar.

─────────────────────────────────────────

📱 TELEGRAM (Recomendado para admin)

? ¿Configurar Telegram? › Sí / No

Si SÍ:

┌─────────────────────────────────────────┐
│  TOKEN DE BOT DE TELEGRAM               │
├─────────────────────────────────────────┤
│                                         │
│  1) Abre Telegram y busca @BotFather    │
│  2) Envía /newbot                       │
│  3) Elige nombre y usuario para tu bot  │
│  4) Copia el token que te da            │
│                                         │
│  El token se ve así:                    │
│  123456789:ABCdefGHIjklMNOpqrSTUvwxyz   │
│                                         │
│  💡 También puedes setear la variable   │
│     de entorno TELEGRAM_BOT_TOKEN       │
│                                         │
└─────────────────────────────────────────┘

? Token del bot de Telegram › 
  [Escribir: 123456789:ABCdefGHIjklMNOpqrSTUvwxyz]
  
  ✅ Token válido!
  Bot: @MiOpenClawBot

? Política de acceso a DMs › 
  ◉ Pairing (recomendado)
    Remitentes desconocidos reciben código de emparejamiento.
    Tú debes aprobarlos.
  
  ○ Allowlist
    Solo usuarios específicos pueden escribir.
  
  ○ Open
    Cualquiera puede escribir (público).

? Tu ID de usuario de Telegram (opcional) › 
  [Escribir: @miusuario o 123456789]
  
  💡 Esto te permitirá usar el bot inmediatamente
     sin necesidad de emparejamiento.
     
  Puedes obtener tu ID hablándole al bot @userinfobot

─────────────────────────────────────────

💬 WHATSAPP (Recomendado para clientes)

? ¿Configurar WhatsApp? › Sí / No

Si SÍ:

? Número de teléfono de WhatsApp › 
  [Escribir: +5491112345678]
  
  💡 Incluir código de país (+54 para Argentina)

🔄 Generando código QR...

┌─────────────────────────────────────────┐
│                                         │
│  [QR CODE AQUÍ - 60 segundos]          │
│                                         │
│  📱 Abre WhatsApp en tu teléfono       │
│  ⚙️ Ajustes → Dispositivos vinculados   │
│  📷 Escanear código QR                  │
│                                         │
│  Tiempo restante: 45 segundos...        │
│                                         │
└─────────────────────────────────────────┘

✅ WhatsApp conectado!
   Número: +5491112345678
   Estado: En línea

? ¿Configurar otro canal? (Discord, Slack, Signal) › 
  ◉ No, continuar
  ○ Discord
  ○ Slack
  ○ Signal
  ○ iMessage (solo Mac)
```

---

## 5️⃣ Configuración de Workspace

```
┌─────────────────────────────────────────┐
│  CONFIGURACIÓN DE WORKSPACE             │
└─────────────────────────────────────────┘

El workspace es donde OpenClaw guarda:
• Archivos de sesión
• Configuración de agentes
• Skills personalizadas

? Ubicación del workspace › 
  [C:\Users\Usuario\.openclaw\workspace] (default)
  
  💡 Debe tener al menos 1GB de espacio disponible.

? ¿Crear directorio de sesiones? › Sí
  C:\Users\Usuario\.openclaw\agents\main\sessions
  
  💡 Aquí se guardan los historiales de conversación.
```

---

## 6️⃣ Skills (Opcional)

```
┌─────────────────────────────────────────┐
│  SKILLS - HABILIDADES ADICIONALES       │
└─────────────────────────────────────────┘

Las skills extienden las capacidades de OpenClaw.

? ¿Instalar skills recomendadas? › Sí / No

Si SÍ:

✓ Session Memory (recordar contexto entre sesiones)
✓ Command Logger (log de comandos ejecutados)
✓ Boot MD (mensaje de inicio personalizable)

? ¿Buscar más skills en ClawHub? › No
  
  💡 Puedes agregar skills más tarde con:
     openclaw skills search
     openclaw skills install <nombre>
```

---

## 7️⃣ Resumen y Finalización

```
┌─────────────────────────────────────────┐
│  ✅ CONFIGURACIÓN COMPLETADA            │
└─────────────────────────────────────────┘

📝 RESUMEN:

🤖 Modelo LLM
   Proveedor: Anthropic
   Modelo: Claude Opus 4.6
   Auth: OAuth (Pro/Max 200)

🌐 Gateway
   Puerto: 18789
   Red: Loopback (localhost)
   Auth: Token seguro

📱 Canales configurados:
   ✓ Telegram: @MiOpenClawBot (pairing)
   ✓ WhatsApp: +5491112345678 (conectado)

💾 Workspace
   Ubicación: C:\Users\Usuario\.openclaw

─────────────────────────────────────────

🚀 PRÓXIMOS PASOS:

1. INICIAR EL GATEWAY:
   $ openclaw gateway --port 18789

2. PROBAR EL BOT:
   - Telegram: Escribe a @MiOpenClawBot
   - WhatsApp: Escribe a tu número desde otro teléfono

3. PANEL WEB:
   http://localhost:18789/admin

4. CONFIGURAR MODO EMPRESARIAL (opcional):
   $ openclaw enterprise setup

   Esto agrega:
   • Personalidad dual (ventas/admin)
   • Múltiples cuentas WhatsApp
   • APIs empresariales
   • Alertas de seguridad

─────────────────────────────────────────

? ¿Quieres iniciar el gateway ahora? › Sí / No

Si SÍ:
   🚀 Iniciando gateway...
   ✓ Gateway corriendo en http://localhost:18789
   
   Presiona Ctrl+C para detener

Si NO:
   💡 Puedes iniciar después con:
      openclaw gateway --port 18789
```

---

---

# PARTE 2: WIZARD EMPRESARIAL (`openclaw enterprise setup`)

## Comando (después de `openclaw onboard`)

```bash
E:\openclaw-main> openclaw enterprise setup

🦞 OpenClaw 2026.2.10
   Bienvenido a la línea de comandos: donde los sueños compilan 
   y la confianza hace segfault.

🏪 OpenClaw Empresarial

✅ PRE-REQUISITOS DETECTADOS:
   
   [✓] Modelo LLM: anthropic/claude-opus-4-6
   [✓] Telegram: Configurado (@MiOpenClawBot)
   [✓] WhatsApp principal: +5491112345678 (conectado)
   [✓] Gateway: Configurado en puerto 18789
   
   Todo listo para configurar el modo empresarial.

Presiona Enter para continuar...
```

---

## 1️⃣ Paso 1: Información del Negocio

```
┌─────────────────────────────────────────┐
│  PASO 1 DE 4: Información del Negocio   │
└─────────────────────────────────────────┘

Esta información personalizará las respuestas del asistente.

─────────────────────────────────────────

? Nombre del negocio › 
  [Escribir: Consultora Finanzas Digital]
  
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

? ¿Qué hace tu negocio? (descripción breve) › 
  [Escribir: Ayudamos a pymes a digitalizar sus procesos financieros]
  
  💡 Esta descripción ayudará al asistente a entender 
     cómo presentar tu negocio a los clientes.
```

---

## 2️⃣ Paso 2: Personalidad VENTAS

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
  
  💡 Este nombre verán tus clientes cuando hablen con el bot.

? Tono de comunicación › 
  ○ Profesional
    Formal, corporativo, directo
  
  ◉ Amigable
    Cálido pero manteniendo profesionalismo
  
  ○ Casual  
    Relajado, cercano, informal
  
  ○ Lujo
    Exclusivo, sofisticado, elegante

? ¿Personalizar áreas de expertise? › Sí

? Selecciona las áreas de expertise (Espacio para marcar, Enter para confirmar)
  
  ◉ Agendar consultas iniciales
  ◉ Informar metodologías y servicios
  ◉ Cotizar proyectos
  ◉ Enviar propuestas comerciales
  ○ Gestionar facturación
  ○ Consultar estado de proyectos activos
  
  💡 Estas son las ÚNICAS cosas que el asistente de ventas
     podrá hacer. Todo lo demás escalará al admin.
```

---

## 3️⃣ Paso 3: Personalidad ADMIN

```
┌─────────────────────────────────────────┐
│  PASO 3 DE 4: Personalidad ADMIN        │
└─────────────────────────────────────────┘

📱 CANAL: Telegram (privado - solo tú)
🎯 FUNCIÓN: Control total del sistema
✅ PERMISOS: Completos

Esta personalidad es para TI (el administrador).
Tiene acceso completo y recibe alertas de seguridad.

─────────────────────────────────────────

? Nombre del asistente admin › 
  [Escribir: Jefe]
  
  💡 Este nombre verás tú en Telegram.

─────────────────────────────────────────

🔒 CARACTERÍSTICAS DEL ADMIN:

✓ Acceso a todos los comandos del sistema
✓ Recepción de alertas de seguridad en tiempo real
  - Intentos de manipulación detectados
  - Clientes que piden cosas fuera del expertise
  - Solicitudes de hablar con humano
  
✓ Capacidad de intervenir conversaciones de ventas
  - Ver conversaciones activas
  - Responder como admin cuando es necesario
  - Tomar control de casos complejos
  
✓ Gestión completa de la configuración

🔄 ESCALADA AUTOMÁTICA:
El asistente de ventas escalará al admin cuando:
• Cliente solicita algo fuera del expertise
• Intento de ingeniería social detectado
• Cliente pide explícitamente hablar con humano
• Problema técnico complejo
• Negociación de precios especiales
```

---

## 4️⃣ Paso 4: Cuentas WhatsApp

```
┌─────────────────────────────────────────┐
│  PASO 4 DE 4: Cuentas WhatsApp          │
└─────────────────────────────────────────┘

Puedes configurar múltiples cuentas de WhatsApp
para diferentes funciones de tu negocio.

Cada cuenta tiene su propio número y propósito.

─────────────────────────────────────────

📱 CUENTA PRINCIPAL (obligatoria)

Esta cuenta ya está configurada desde el wizard anterior:
   ✅ VENTAS: +5491112345678 (conectado)

─────────────────────────────────────────

? ¿Agregar cuenta adicional de WhatsApp? › Sí

? Tipo de cuenta › 
  ◉ COMPRAS
    📦 Gestión de proveedores y stock
    📝 Órdenes de compra, consultas a proveedores
    🔒 Acceso: Restringido (solo tú y proveedores)
  
  ○ SOPORTE
    🛠️ Atención post-venta y técnica
    📝 Tickets, troubleshooting, garantías
    🔒 Acceso: Público (clientes con problemas)
  
  ○ VIP
    👑 Clientes premium exclusivos
    📝 Atención prioritaria y personalizada
    🔒 Acceso: Allowlist (solo clientes VIP)

? Número de WhatsApp COMPRAS (con código de país) › 
  [Escribir: +5491187654321]
  
  💡 Este número debe tener WhatsApp Business instalado
     y estar disponible para escanear el QR.

─────────────────────────────────────────

✅ Cuenta COMPRAS agregada
   Número: +5491187654321
   Estado: Pendiente de escanear QR

─────────────────────────────────────────

? ¿Agregar otra cuenta? › Sí

? Tipo de cuenta › 
  ○ COMPRAS
  ◉ SOPORTE
  ○ VIP

? Número de WhatsApp SOPORTE › 
  [Escribir: +5491198765432]

─────────────────────────────────────────

✅ Cuenta SOPORTE agregada
   Número: +5491198765432
   Estado: Pendiente de escanear QR

─────────────────────────────────────────

? ¿Agregar otra cuenta? › No

📊 RESUMEN DE CUENTAS:

  ✅ VENTAS:   +5491112345678 (conectado)
  ⏳ COMPRAS:  +5491187654321 (falta QR)
  ⏳ SOPORTE:  +5491198765432 (falta QR)
```

---

## 5️⃣ Resumen y Confirmación

```
┌─────────────────────────────────────────┐
│         🔍 REVISAR CONFIGURACIÓN        │
├─────────────────────────────────────────┤
│                                         │
│  🏢 NEGOCIO                             │
│  ├─ Nombre: Consultora Finanzas Digital │
│  ├─ Tipo: Consultoría                   │
│  └─ Descripción: Ayudamos a pymes a     │
│    digitalizar sus procesos financieros │
│                                         │
│  👤 PERSONALIDAD VENTAS                 │
│  ├─ Canal: WhatsApp (público)           │
│  ├─ Nombre: Ana                         │
│  ├─ Tono: Amigable                      │
│  ├─ Expertise (4 áreas):                │
│  │  • Agendar consultas iniciales       │
│  │  • Informar metodologías             │
│  │  • Cotizar proyectos                 │
│  │  • Enviar propuestas                 │
│  └─ Acceso: Limitado (escala automática)│
│                                         │
│  👔 PERSONALIDAD ADMIN                  │
│  ├─ Canal: Telegram (privado)           │
│  ├─ Nombre: Jefe                        │
│  └─ Acceso: Completo + Alertas          │
│                                         │
│  📱 CUENTAS WHATSAPP                    │
│  ├─ ✅ VENTAS:   +5491112345678         │
│  ├─ ⏳ COMPRAS:  +5491187654321         │
│  └─ ⏳ SOPORTE:  +5491198765432         │
│                                         │
│  ⏳ = Requiere escanear QR               │
│                                         │
└─────────────────────────────────────────┘

? ¿Todo está correcto? Aplicar configuración › Sí / No

[Si No: Cancela y vuelve al inicio]

[Si Sí:]

💾 Guardando configuración...

✅ Configuración empresarial aplicada correctamente.
```

---

## 6️⃣ Outro - Próximos Pasos

```
┌─────────────────────────────────────────┐
│  ✅ CONFIGURACIÓN EMPRESARIAL COMPLETA  │
└─────────────────────────────────────────┘

🎉 Tu asistente empresarial está configurado!

─────────────────────────────────────────

🚨 IMPORTANTE: ESCANEAR CÓDIGOS QR

Las cuentas adicionales necesitan activarse escaneando
su código QR individual:

📱 COMPRAS (+5491187654321):
   $ openclaw channels login whatsapp --account compras
   
   Aparecerá un código QR. Escanealo con WhatsApp Business
   de ese número (Ajustes → Dispositivos vinculados).
   
   ⏱️ Tienes 60 segundos para escanear.

📱 SOPORTE (+5491198765432):
   $ openclaw channels login whatsapp --account soporte
   
   Repetir el mismo proceso.

💡 Si el tiempo se agota, ejecuta el comando de nuevo.

─────────────────────────────────────────

🚀 INICIAR EL SISTEMA

Una vez escaneados todos los QR:

   $ openclaw gateway --port 18789

Verás:
   ✓ Gateway iniciado en http://localhost:18789
   ✓ Telegram: @MiOpenClawBot conectado
   ✓ WhatsApp VENTAS: Conectado
   ✓ WhatsApp COMPRAS: Conectado (después del QR)
   ✓ WhatsApp SOPORTE: Conectado (después del QR)

─────────────────────────────────────────

🌐 PANEL DE ADMINISTRACIÓN

Abre en tu navegador:
   http://localhost:18789/admin

Desde aquí puedes:
• Ver estado de todos los canales
• Ver conversaciones activas
• Configurar APIs adicionales
• Gestionar personalidades
• Ver alertas de seguridad

─────────────────────────────────────────

💬 COMANDOS ÚTILES

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

🧪 PROBAR EL SISTEMA

1. Escribe a @MiOpenClawBot (Telegram) como admin
2. Escribe al WhatsApp de VENTAS como cliente
3. Intenta pedir algo fuera del expertise de ventas
4. Observa cómo escala automáticamente a Telegram

─────────────────────────────────────────

📚 DOCUMENTACIÓN Y AYUDA

• Guía rápida: https://docs.openclaw.ai/quickstart
• Seguridad: https://docs.openclaw.ai/security
• APIs empresariales: https://docs.openclaw.ai/enterprise-apis
• Comunidad: https://discord.gg/clawd

─────────────────────────────────────────

🦞 ¡OpenClaw Empresarial está listo!
   Exfoliate! Exfoliate!

Presiona Enter para salir...
```

---

---

# DIAGRAMA DE FLUJO COMPLETO

```
USUARIO
   │
   ▼
┌─────────────────────┐
│ openclaw onboard    │ ◄── WIZARD ORIGINAL (Primero)
└─────────────────────┘
   │
   ├──► 0️⃣ Advertencia seguridad
   ├──► 1️⃣ Modo (QuickStart/Manual)
   ├──► 2️⃣ Auth LLM (Anthropic/OpenAI)
   ├──► 3️⃣ Gateway (puerto, red, auth)
   ├──► 4️⃣ Canales (Telegram, WhatsApp QR)
   ├──► 5️⃣ Workspace
   ├──► 6️⃣ Skills (opcional)
   └──► 7️⃣ Resumen + Iniciar gateway
           │
           ▼
    ┌─────────────────┐
    │ Gateway corriendo│
    │ http://localhost:18789
    └─────────────────┘
           │
           ▼
┌─────────────────────┐
│ openclaw enterprise │ ◄── WIZARD EMPRESARIAL (Segundo)
│ setup               │
└─────────────────────┘
   │
   ├──► ✅ Verifica pre-requisitos
   │    (si faltan, error y sale)
   │
   ├──► 1️⃣ Info del negocio
   ├──► 2️⃣ Personalidad VENTAS (checkboxes)
   ├──► 3️⃣ Personalidad ADMIN
   ├──► 4️⃣ Cuentas WhatsApp (multi-cuenta)
   └──► 5️⃣ Resumen + Aplicar
           │
           ▼
    ⏳ Escanear QR cuentas adicionales
           │
           ▼
    🚀 Iniciar gateway
           │
           ▼
    ✅ Sistema completo funcionando
    • WhatsApp VENTAS: Clientes
    • WhatsApp COMPRAS/SOPORTE: Otras funciones
    • Telegram: Admin (tú)
    • Dual personality activa
    • Escalada automática funcionando
```

---

# CHECKLIST POST-INSTALACIÓN

- [ ] Ejecutar `openclaw onboard` completamente
- [ ] Verificar gateway corriendo en http://localhost:18789
- [ ] Probar bot de Telegram (enviar mensaje, recibir respuesta)
- [ ] Probar WhatsApp principal (escanear QR, enviar mensaje)
- [ ] Ejecutar `openclaw enterprise setup`
- [ ] Configurar múltiples cuentas WhatsApp si es necesario
- [ ] Escanear QR de cuentas adicionales
- [ ] Probar escalada (pedir algo fuera de expertise en ventas)
- [ ] Verificar alerta llega a Telegram
- [ ] Probar panel web
- [ ] Configurar APIs externas si es necesario

---

*Documento completo para referencia*
*Fecha: 2026-02-13*
