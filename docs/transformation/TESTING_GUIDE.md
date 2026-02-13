# Guía de Pruebas - OpenClaw Transformado

Esta guía te ayudará a probar todas las funcionalidades implementadas en el proyecto de transformación de OpenClaw.

## 📋 Requisitos Previos

### 1. Dependencias del Sistema

```powershell
# Verificar Node.js (versión 18+)
node --version

# Verificar pnpm
pnpm --version

# Si no tienes pnpm, instalarlo
npm install -g pnpm
```

### 2. Variables de Entorno

Crea o edita el archivo `.env` en la raíz del proyecto:

```env
# Telegram Bot Token (obligatorio para testing)
TELEGRAM_BOT_TOKEN=tu_token_aqui

# Opcional: Otras APIs
BRAVE_API_KEY=tu_brave_key
OPENAI_API_KEY=tu_openai_key
```

## 🚀 Paso 1: Instalación y Compilación

```powershell
# Navegar al directorio del proyecto
cd e:\openclaw-main

# Instalar dependencias
pnpm install

# Compilar el proyecto
pnpm run build

# Verificar que no hay errores de TypeScript
pnpm run typecheck
```

**Resultado esperado**: Compilación exitosa sin errores.

## 🔧 Paso 2: Configuración Inicial

### 2.1 Obtener tu Telegram User ID

1. Abre Telegram
2. Busca el bot `@userinfobot`
3. Envía `/start`
4. Copia tu User ID (número)

### 2.2 Configurar el Superadmin

Edita `~/.openclaw/openclaw.json` (o créalo si no existe):

```json
{
  "gateway": {
    "superadmin": {
      "telegramUserId": 123456789,
      "activationKeyword": "ACTIVAR_BOT_2024",
      "enabled": true
    },
    "tools": {
      "publicAllowed": [
        "web_search",
        "web_fetch",
        "read_file"
      ],
      "publicDenied": [
        "file_delete",
        "file_write",
        "exec"
      ],
      "mode": "whitelist"
    }
  }
}
```

**Reemplaza** `123456789` con tu User ID real.

## ▶️ Paso 3: Iniciar OpenClaw

```powershell
# Iniciar en modo desarrollo
pnpm run dev

# O iniciar en modo producción
pnpm start
```

**Resultado esperado**:
```
[info] OpenClaw gateway starting...
[info] Telegram bot initialized
[info] Superadmin filter enabled for user ID: 123456789
[info] Gateway health monitor started
[info] Channel monitor initialized
```

## 🧪 Paso 4: Pruebas de Funcionalidad

### Test 1: Autenticación de Telegram Superadmin ✅

**Objetivo**: Verificar que solo tú puedes usar el bot de Telegram.

1. Abre Telegram y busca tu bot
2. Envía un mensaje: `ACTIVAR_BOT_2024`
3. **Resultado esperado**: `✅ Bot activado. Ahora puedes usar todas las funcionalidades.`
4. Envía: `Hola, ¿cómo estás?`
5. **Resultado esperado**: El bot responde normalmente

**Prueba de seguridad**:
- Pide a otra persona que envíe un mensaje al bot
- **Resultado esperado**: El bot NO responde (ignora silenciosamente)

### Test 2: Filtro de Herramientas por Rol ✅

**Objetivo**: Verificar que las herramientas están restringidas correctamente.

**Como Superadmin (Telegram)**:
1. Envía: `Lista todos los archivos en el directorio actual`
2. **Resultado esperado**: El bot puede listar archivos
3. Envía: `Crea un archivo de prueba llamado test.txt`
4. **Resultado esperado**: El bot puede crear archivos

**Como Usuario Público (otro canal)**:
1. Desde WhatsApp u otro canal, envía: `Crea un archivo test.txt`
2. **Resultado esperado**: 
   ```
   ❌ Herramienta no disponible: file_write
   
   Esta herramienta está restringida para usuarios públicos por razones de seguridad.
   ```

### Test 3: Autorización Root vía Telegram 🔐

**Objetivo**: Verificar que operaciones críticas requieren aprobación.

1. Desde Telegram, envía: `Elimina el archivo test.txt`
2. **Resultado esperado en Telegram**:
   ```
   🔐 SOLICITUD DE AUTORIZACIÓN
   
   Operación: file_delete
   Parámetros:
     • path: test.txt
   
   ⏱️ Expira en: 5m 0s
   
   [✅ Aprobar] [❌ Rechazar]
   ```
3. Click en "✅ Aprobar"
4. **Resultado esperado**: El archivo se elimina y recibes confirmación

**Prueba de rechazo**:
1. Envía: `Reinicia el sistema`
2. Recibes solicitud de autorización
3. Click en "❌ Rechazar"
4. **Resultado esperado**: `❌ Operación rechazada por el superadmin`

### Test 4: Panel de Administración Web 🌐

**Objetivo**: Verificar que el panel web funciona.

1. Abre tu navegador
2. Navega a: `http://localhost:18789/admin` (puerto por defecto del gateway)
3. **Resultado esperado**: Página de login

**Login**:
1. Ingresa tu contraseña de admin (configurada en setup)
2. **Resultado esperado**: Solicitud de código 2FA vía Telegram
3. Revisa Telegram, copia el código
4. Ingrésalo en el panel web
5. **Resultado esperado**: Acceso al dashboard

**Dashboard**:
- Verifica que ves:
  - ✅ Métricas del sistema (memoria, CPU, uptime)
  - ✅ Estado de canales (Telegram, WhatsApp, etc.)
  - ✅ Número de solicitudes procesadas
  - ✅ Gráficas de actividad

### Test 5: Gestión de APIs Dinámicas 🔌

**Objetivo**: Verificar que puedes registrar y usar APIs externas.

1. En el panel web, navega a "Gestión de APIs"
2. Click en "➕ Agregar Nueva API"
3. Completa el formulario:
   ```
   ID: test-api
   Nombre: API de Prueba
   URL Base: https://jsonplaceholder.typicode.com
   Tipo de Auth: Sin autenticación
   Endpoints: [
     {
       "name": "getUsers",
       "path": "/users",
       "method": "GET"
     }
   ]
   ```
4. Click en "💾 Guardar API"
5. **Resultado esperado**: API aparece en la lista

**Probar la API**:
1. Desde Telegram, envía: `Llama a la API test-api endpoint getUsers`
2. **Resultado esperado**: Lista de usuarios de JSONPlaceholder

### Test 6: Monitoreo de Servicios 📊

**Objetivo**: Verificar que el monitoreo funciona.

1. En el panel web, navega a "Monitoreo"
2. **Resultado esperado**: Ves métricas en tiempo real:
   ```
   Gateway Health: HEALTHY
   Uptime: 2.5h
   Memory: 45.2%
   Requests: 1,234
   Errors (1min): 0
   Avg Latency: 125ms
   
   Channels:
   - Telegram: ONLINE (250 mensajes, 0 errores)
   - WhatsApp: ONLINE (180 mensajes, 0 errores)
   ```

### Test 7: Integración con Google Calendar 📅

**Objetivo**: Verificar integración con Google (si configuraste OAuth2).

1. Registra la API de Google Calendar (ver `GOOGLE_INTEGRATION.md`)
2. Desde Telegram, envía: `Lista mis eventos de hoy en Google Calendar`
3. **Resultado esperado**: Lista de eventos del día

## 🐛 Troubleshooting

### Problema: Bot de Telegram no responde

**Solución**:
```powershell
# Verificar logs
pnpm run dev

# Buscar en logs:
# [info] Telegram bot initialized
# [info] Superadmin filter enabled for user ID: XXXXX
```

Si no ves estos mensajes:
1. Verifica que `TELEGRAM_BOT_TOKEN` esté en `.env`
2. Verifica que `telegramUserId` sea correcto en `openclaw.json`

### Problema: "Herramienta no disponible" para todo

**Solución**:
1. Verifica que estés usando Telegram (canal de superadmin)
2. Verifica que hayas activado el bot con la palabra clave
3. Revisa `openclaw.json` → `gateway.superadmin.enabled` debe ser `true`

### Problema: Panel web no carga

**Solución**:
```powershell
# Verificar que el servidor web esté corriendo
# Buscar en logs:
# [info] Web admin panel listening on port 3000
```

Si no está corriendo:
1. Verifica configuración en `openclaw.json`
2. Asegúrate de que el puerto no esté ocupado

### Problema: Solicitudes de autorización no llegan

**Solución**:
1. Verifica que `root-authorization.ts` esté integrado
2. Revisa logs:
   ```
   [info] Authorization request sent to superadmin: auth_XXXXX
   ```
3. Verifica que tu User ID sea correcto

## ✅ Checklist de Pruebas Completas

Marca cada item al completarlo:

- [ ] ✅ Instalación y compilación exitosa
- [ ] ✅ Configuración de superadmin
- [ ] ✅ Bot de Telegram responde solo a superadmin
- [ ] ✅ Usuarios no autorizados son bloqueados
- [ ] ✅ Filtro de herramientas funciona (public vs superadmin)
- [ ] ✅ Mensajes de error amigables para tools prohibidos
- [ ] ✅ Autorización root vía Telegram funciona
- [ ] ✅ Aprobación de operaciones críticas
- [ ] ✅ Rechazo de operaciones críticas
- [ ] ✅ Panel web accesible
- [ ] ✅ Login con 2FA funciona
- [ ] ✅ Dashboard muestra métricas
- [ ] ✅ Gestión de APIs dinámicas
- [ ] ✅ Registro de nueva API
- [ ] ✅ Ejecución de llamadas a API
- [ ] ✅ Monitoreo de gateway funciona
- [ ] ✅ Monitoreo de canales funciona
- [ ] ✅ Google Calendar/Drive (si configurado)

## 📝 Reportar Problemas

Si encuentras algún problema:

1. **Captura los logs**:
   ```powershell
   pnpm run dev > logs.txt 2>&1
   ```

2. **Información a incluir**:
   - Versión de Node.js: `node --version`
   - Sistema operativo: Windows
   - Paso donde falló
   - Mensaje de error completo
   - Logs relevantes

3. **Archivos de configuración** (sin tokens):
   - `openclaw.json` (oculta tokens/secrets)
   - `.env` (oculta valores sensibles)

## 🎉 Prueba Exitosa

Si completaste todos los checks, ¡felicitaciones! El sistema está funcionando correctamente.

**Próximos pasos**:
1. Configura tus APIs empresariales reales
2. Ajusta la lista de herramientas permitidas según tus necesidades
3. Invita a usuarios a los canales públicos
4. Monitorea el uso y ajusta según sea necesario

---

**Última actualización**: 2026-02-12  
**Versión**: 1.0  
**Estado**: Listo para producción
