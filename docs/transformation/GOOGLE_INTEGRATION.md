# Integración con Google Calendar y Google Drive

Esta guía explica cómo integrar Google Calendar y Google Drive como APIs dinámicas en OpenClaw.

## 📋 Requisitos Previos

1. Cuenta de Google Cloud Platform
2. Proyecto creado en GCP
3. APIs habilitadas:
   - Google Calendar API
   - Google Drive API
4. Credenciales OAuth 2.0 configuradas

## 🔧 Configuración de Google Calendar

### Paso 1: Obtener Credenciales

1. Ve a [Google Cloud Console](https://console.cloud.google.com)
2. Selecciona tu proyecto
3. Navega a "APIs & Services" > "Credentials"
4. Crea credenciales OAuth 2.0
5. Descarga el archivo JSON de credenciales

### Paso 2: Registrar la API

```json
{
  "id": "google-calendar",
  "name": "Google Calendar API",
  "baseUrl": "https://www.googleapis.com/calendar/v3",
  "description": "Gestión de eventos y calendarios de Google",
  "auth": {
    "type": "oauth2",
    "oauth2": {
      "clientId": "your-client-id.apps.googleusercontent.com",
      "clientSecret": "your-client-secret",
      "tokenUrl": "https://oauth2.googleapis.com/token",
      "accessToken": "ya29.a0...",
      "refreshToken": "1//0g..."
    }
  },
  "endpoints": [
    {
      "name": "listEvents",
      "path": "/calendars/primary/events",
      "method": "GET",
      "description": "Lista eventos del calendario principal",
      "parameters": [
        {
          "name": "timeMin",
          "type": "string",
          "required": false,
          "description": "Fecha/hora mínima (RFC3339)"
        },
        {
          "name": "timeMax",
          "type": "string",
          "required": false,
          "description": "Fecha/hora máxima (RFC3339)"
        },
        {
          "name": "maxResults",
          "type": "number",
          "required": false,
          "description": "Número máximo de eventos (default: 250)"
        }
      ]
    },
    {
      "name": "createEvent",
      "path": "/calendars/primary/events",
      "method": "POST",
      "description": "Crea un nuevo evento en el calendario",
      "parameters": [
        {
          "name": "summary",
          "type": "string",
          "required": true,
          "description": "Título del evento"
        },
        {
          "name": "start",
          "type": "object",
          "required": true,
          "description": "Fecha/hora de inicio"
        },
        {
          "name": "end",
          "type": "object",
          "required": true,
          "description": "Fecha/hora de fin"
        },
        {
          "name": "description",
          "type": "string",
          "required": false,
          "description": "Descripción del evento"
        }
      ]
    },
    {
      "name": "deleteEvent",
      "path": "/calendars/primary/events/{eventId}",
      "method": "DELETE",
      "description": "Elimina un evento del calendario",
      "parameters": [
        {
          "name": "eventId",
          "type": "string",
          "required": true,
          "description": "ID del evento a eliminar"
        }
      ]
    }
  ],
  "enabled": true,
  "tags": ["google", "calendar", "productivity"]
}
```

### Ejemplo de Uso

```typescript
import { dynamicAPIManager, apiExecutor } from './src/enterprise';

// Registrar la API
dynamicAPIManager.registerAPI(googleCalendarConfig);

// Listar eventos de hoy
const today = new Date().toISOString();
const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

const result = await apiExecutor.executeByEndpointName(
  dynamicAPIManager.getAPI('google-calendar'),
  'listEvents',
  {
    timeMin: today,
    timeMax: tomorrow,
    maxResults: 10
  }
);

if (result.success) {
  console.log('Eventos de hoy:', result.data);
}

// Crear un evento
const createResult = await apiExecutor.executeByEndpointName(
  dynamicAPIManager.getAPI('google-calendar'),
  'createEvent',
  {
    summary: 'Reunión con el equipo',
    start: {
      dateTime: '2026-02-15T10:00:00-03:00',
      timeZone: 'America/Argentina/Buenos_Aires'
    },
    end: {
      dateTime: '2026-02-15T11:00:00-03:00',
      timeZone: 'America/Argentina/Buenos_Aires'
    },
    description: 'Revisión semanal del proyecto'
  }
);
```

## 📁 Configuración de Google Drive

### Paso 1: Registrar la API

```json
{
  "id": "google-drive",
  "name": "Google Drive API",
  "baseUrl": "https://www.googleapis.com/drive/v3",
  "description": "Gestión de archivos en Google Drive",
  "auth": {
    "type": "oauth2",
    "oauth2": {
      "clientId": "your-client-id.apps.googleusercontent.com",
      "clientSecret": "your-client-secret",
      "tokenUrl": "https://oauth2.googleapis.com/token",
      "accessToken": "ya29.a0...",
      "refreshToken": "1//0g..."
    }
  },
  "endpoints": [
    {
      "name": "listFiles",
      "path": "/files",
      "method": "GET",
      "description": "Lista archivos en Google Drive",
      "parameters": [
        {
          "name": "q",
          "type": "string",
          "required": false,
          "description": "Query de búsqueda"
        },
        {
          "name": "pageSize",
          "type": "number",
          "required": false,
          "description": "Número de archivos por página (max: 1000)"
        },
        {
          "name": "orderBy",
          "type": "string",
          "required": false,
          "description": "Campo de ordenamiento (ej: 'modifiedTime desc')"
        }
      ]
    },
    {
      "name": "getFile",
      "path": "/files/{fileId}",
      "method": "GET",
      "description": "Obtiene metadata de un archivo",
      "parameters": [
        {
          "name": "fileId",
          "type": "string",
          "required": true,
          "description": "ID del archivo"
        },
        {
          "name": "fields",
          "type": "string",
          "required": false,
          "description": "Campos a retornar"
        }
      ]
    },
    {
      "name": "createFolder",
      "path": "/files",
      "method": "POST",
      "description": "Crea una nueva carpeta",
      "parameters": [
        {
          "name": "name",
          "type": "string",
          "required": true,
          "description": "Nombre de la carpeta"
        },
        {
          "name": "parents",
          "type": "array",
          "required": false,
          "description": "IDs de carpetas padre"
        }
      ]
    },
    {
      "name": "deleteFile",
      "path": "/files/{fileId}",
      "method": "DELETE",
      "description": "Elimina un archivo o carpeta",
      "parameters": [
        {
          "name": "fileId",
          "type": "string",
          "required": true,
          "description": "ID del archivo a eliminar"
        }
      ]
    }
  ],
  "enabled": true,
  "tags": ["google", "drive", "storage"]
}
```

### Ejemplo de Uso

```typescript
// Listar archivos recientes
const filesResult = await apiExecutor.executeByEndpointName(
  dynamicAPIManager.getAPI('google-drive'),
  'listFiles',
  {
    pageSize: 10,
    orderBy: 'modifiedTime desc',
    q: "mimeType='application/pdf'"
  }
);

if (filesResult.success) {
  console.log('Archivos PDF recientes:', filesResult.data);
}

// Crear una carpeta
const folderResult = await apiExecutor.executeByEndpointName(
  dynamicAPIManager.getAPI('google-drive'),
  'createFolder',
  {
    name: 'Proyecto OpenClaw',
    parents: ['root']
  }
);
```

## 🔄 Renovación de Tokens OAuth2

Los tokens de acceso de Google expiran después de 1 hora. Implementa un sistema de renovación:

```typescript
async function refreshGoogleToken(refreshToken: string): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: 'your-client-id',
      client_secret: 'your-client-secret',
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });

  const data = await response.json();
  return data.access_token;
}

// Actualizar el token en la API
const newToken = await refreshGoogleToken(refreshToken);
dynamicAPIManager.updateAPI('google-calendar', {
  auth: {
    type: 'oauth2',
    oauth2: {
      ...existingOAuth2Config,
      accessToken: newToken
    }
  }
});
```

## 📊 Casos de Uso Comunes

### 1. Agendar Reunión Automáticamente

```typescript
async function scheduleTeamMeeting(title: string, date: Date, durationHours: number) {
  const start = date.toISOString();
  const end = new Date(date.getTime() + durationHours * 60 * 60 * 1000).toISOString();

  return await apiExecutor.executeByEndpointName(
    dynamicAPIManager.getAPI('google-calendar'),
    'createEvent',
    {
      summary: title,
      start: { dateTime: start },
      end: { dateTime: end },
      attendees: [
        { email: 'team@example.com' }
      ]
    }
  );
}
```

### 2. Buscar Archivos por Tipo

```typescript
async function findDocuments(fileType: string) {
  const mimeTypes = {
    'pdf': 'application/pdf',
    'doc': 'application/vnd.google-apps.document',
    'sheet': 'application/vnd.google-apps.spreadsheet'
  };

  return await apiExecutor.executeByEndpointName(
    dynamicAPIManager.getAPI('google-drive'),
    'listFiles',
    {
      q: `mimeType='${mimeTypes[fileType]}'`,
      pageSize: 20
    }
  );
}
```

### 3. Organizar Archivos en Carpetas

```typescript
async function organizeFiles() {
  // Crear carpeta
  const folderResult = await apiExecutor.executeByEndpointName(
    dynamicAPIManager.getAPI('google-drive'),
    'createFolder',
    { name: '2026 Reports' }
  );

  const folderId = folderResult.data.id;

  // Mover archivos a la carpeta
  // (requiere endpoint adicional de update)
}
```

## ⚠️ Consideraciones de Seguridad

1. **Nunca hardcodees tokens**: Usa variables de entorno
2. **Limita scopes**: Solo solicita los permisos necesarios
3. **Rota tokens**: Implementa renovación automática
4. **Audita accesos**: Registra todas las operaciones
5. **Usa HTTPS**: Siempre para comunicación con APIs

## 🔗 Referencias

- [Google Calendar API Docs](https://developers.google.com/calendar/api)
- [Google Drive API Docs](https://developers.google.com/drive/api)
- [OAuth 2.0 for Google APIs](https://developers.google.com/identity/protocols/oauth2)

---

**Última actualización**: 2026-02-12  
**Versión**: 1.0
