# Quick Start - Usar OpenClaw Superadmin

## 🎯 Qué vamos a hacer

1. Iniciar el servidor del panel de administración
2. Probar que funcione
3. Ver el panel web en el navegador

---

## ▶️ Paso 1: Iniciar el Servidor

Abre **PowerShell** en esta carpeta y ejecuta:

```powershell
npx tsx start-system.mjs
```

Deberías ver:
```
🚀 Iniciando OpenClaw Admin System

==================================================
✅ Sistema iniciado en http://localhost:8765

📍 URLs disponibles:
   • Login:     http://localhost:8765/admin/login
   • Health:    http://localhost:8765/admin/api/health
   • Dashboard: http://localhost:8765/admin/dashboard

⚠️  Para detener: Ctrl+C
```

**NO CIERRES ESTA VENTANA** - El servidor debe quedar corriendo.

---

## ▶️ Paso 2: Probar que Funcione

Abre **otra ventana de PowerShell** (sin cerrar la primera) y ejecuta:

```powershell
# Probar el health check
Invoke-RestMethod -Uri "http://localhost:8765/admin/api/health" -Method GET
```

Deberías ver algo como:
```json
{
  "ok": true,
  "data": {
    "status": "healthy",
    "uptime": 12.45,
    "memory": { "used": 23456789, "total": 45678901, "percentage": 51 },
    "timestamp": "2026-02-12T..."
  }
}
```

✅ **¡Funciona!**

---

## ▶️ Paso 3: Ver el Panel Web

Abre tu navegador y ve a:

**http://localhost:8765/admin/login**

Verás:
- Una página de login con diseño moderno
- Campos para usuario y contraseña
- Botón de "Continue"

---

## ▶️ Paso 4: Explorar el Sistema

### URLs disponibles:

| URL | Qué verás |
|-----|-----------|
| http://localhost:8765/admin/login | Página de login |
| http://localhost:8765/admin/api/health | Estado del sistema (JSON) |
| http://localhost:8765/admin/dashboard | Dashboard (pide login) |

---

## 🛑 Paso 5: Detener el Servidor

Cuando termines, ve a la **primera ventana de PowerShell** (donde corre el servidor) y presiona:

```
Ctrl + C
```

---

## 🔧 Qué sigue después

Para usar el sistema COMPLETO con todas las funciones:

### 1. Configurar Telegram (para recibir códigos 2FA)

Edita `config.json` y pon:
- Tu ID de usuario de Telegram
- El token de tu bot de Telegram
- El hash de tu contraseña

### 2. Funcionalidades disponibles

Una vez configurado tendrás:

| Función | Descripción |
|---------|-------------|
| **Login 2FA** | Password + código por Telegram |
| **Dashboard** | Ver métricas del sistema |
| **Root Auth** | Aprobación para operaciones críticas |
| **Alertas** | Notificaciones Telegram de problemas |

---

## ❓ Solución de Problemas

### "No se reconoce npx"
Instala Node.js desde https://nodejs.org

### "Error al cargar módulo"
Ejecuta primero:
```powershell
npm install
```

### "El puerto 8765 está en uso"
Cambia el puerto en `start-system.mjs`:
```javascript
const PORT = 8766; // u otro número
```

---

## 📞 Resumen de Comandos

```powershell
# Instalar dependencias (una sola vez)
npm install

# Iniciar servidor
npx tsx start-system.mjs

# Probar health (en otra ventana)
Invoke-RestMethod -Uri "http://localhost:8765/admin/api/health" -Method GET

# O con curl
curl http://localhost:8765/admin/api/health
```

---

**¿Listo para empezar?** Abre PowerShell y ejecuta: `npx tsx start-system.mjs`
