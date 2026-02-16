# Wrapper SaaS - Plan de Desarrollo

## Resumen del Proyecto

**Wrapper** es un SaaS que vende infraestructura gestionada de Agento (fork empresarial de OpenClaw). Cada cliente que paga una suscripción obtiene su propia instancia de Agento corriendo en un contenedor Docker aislado, accesible a través de un subdominio único (ej: `cliente1.misaas.com`).

### Arquitectura de Responsabilidades

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         LARAVEL (SaaS Manager)                          │
│                         app.misaas.com                                  │
│                                                                         │
│   RESPONSABILIDADES:                                                    │
│   ✓ Registro de usuarios                                               │
│   ✓ Pagos (Stripe/MercadoPago)                                         │
│   ✓ Crear/Eliminar contenedores Docker                                 │
│   ✓ Gestionar suscripciones                                            │
│   ✓ Soporte técnico                                                    │
│                                                                         │
│   NO HACE:                                                              │
│   ✗ Maneja usuarios dentro del contenedor                              │
│   ✗ Configura el agente del cliente                                    │
│   ✗ Tiene acceso a los datos del contenedor                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Crea contenedor
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    CONTENEDOR CLIENTE (Agento)                          │
│                    cliente1.misaas.com                                  │
│                                                                         │
│   CONTIENE TODO:                                                        │
│   ✓ Agento completo                                                     │
│   ✓ Wizard web de configuración                                         │
│   ✓ Sistema de usuarios/empleados (archivos JSON)                      │
│   ✓ Workspace con memoria (Markdown)                                    │
│   ✓ Canales (WhatsApp, Telegram, etc.)                                 │
│   ✓ Tools y acceso a internet                                           │
│   ✓ Panel de administración propio                                      │
│                                                                         │
│   LIMITADO POR:                                                         │
│   • RAM según plan (512MB / 1GB / 2GB)                                 │
│   • CPU según plan (0.5 / 1 / 2 vCPU)                                  │
│   • Almacenamiento según plan                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Arquitectura General

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              INTERNET                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          TRAEFIK (Proxy Reverso)                         │
│                    *.misaas.com → SSL automático                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐         ┌───────────────┐         ┌───────────────┐
│    LARAVEL    │         │  CONTENEDOR   │         │  CONTENEDOR   │
│  (SaaS Main)  │         │   CLIENTE A   │         │   CLIENTE B   │
│               │         │               │         │               │
│  app.misaas.  │         │ clienteA.mis. │         │ clienteB.mis. │
│     com       │         │    saas.com   │         │    saas.com   │
│               │         │               │         │               │
│  - Registro   │         │ ┌───────────┐ │         │ ┌───────────┐ │
│  - Pagos      │         │ │  AGENTO   │ │         │ │  AGENTO   │ │
│  - Orquesta   │         │ │  COMPLETO │ │         │ │  COMPLETO │ │
│    Docker     │         │ │           │ │         │ │           │ │
│               │         │ │ • Wizard  │ │         │ │ • Wizard  │ │
│               │         │ │ • Usuarios│ │         │ │ • Usuarios│ │
│               │         │ │ • Canales │ │         │ │ • Canales │ │
│               │         │ │ • Tools   │ │         │ │ • Tools   │ │
│               │         │ │ • Memoria │ │         │ │ • Memoria │ │
│               │         │ └───────────┘ │         │ └───────────┘ │
│               │         │               │         │               │
│               │         │ 512MB RAM     │         │ 1GB RAM       │
│               │         │ 0.5 CPU       │         │ 1 CPU         │
└───────────────┘         └───────────────┘         └───────────────┘
        │                         │                         │
        │                         ▼                         ▼
        │                 ┌───────────────┐         ┌───────────────┐
        │                 │   VOLUMEN     │         │   VOLUMEN     │
        │                 │ Persistencia  │         │ Persistencia  │
        │                 │ del cliente   │         │ del cliente   │
        │                 └───────────────┘         └───────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────────┐
│                         DOCKER SOCKET                                  │
│              (Laravel crea/destruye contenedores)                      │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 2. Flujo Completo del Usuario

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      FLUJO DEL CLIENTE                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. REGISTRO (Laravel SaaS)                                             │
│     ┌─────────────────────────────────────────┐                         │
│     │  app.misaas.com/register                │                         │
│     │  • Email, password                      │                         │
│     │  • Selecciona plan                      │                         │
│     └─────────────────────────────────────────┘                         │
│                         │                                               │
│                         ▼                                               │
│  2. PAGO (Laravel → Stripe/MP)                                          │
│     ┌─────────────────────────────────────────┐                         │
│     │  Checkout Stripe/MercadoPago            │                         │
│     │  • $19 Básico / $49 Pro / $149 Enterpr. │                         │
│     └─────────────────────────────────────────┘                         │
│                         │                                               │
│                         ▼                                               │
│  3. PROVISIONAMIENTO (Laravel → Docker)                                 │
│     ┌─────────────────────────────────────────┐                         │
│     │  Webhook confirma pago                  │                         │
│     │  → Laravel crea contenedor              │                         │
│     │  → Asigna subdominio: tienda-j4k2.misaa │                         │
│     │  → Configura límites según plan         │                         │
│     │  → Envía email con URL y token          │                         │
│     └─────────────────────────────────────────┘                         │
│                         │                                               │
│                         ▼                                               │
│  4. PRIMER ACCESO (Contenedor Agento)                                   │
│     ┌─────────────────────────────────────────┐                         │
│     │  tienda-j4k2.misaas.com                 │                         │
│     │  • Wizard web de bienvenida             │                         │
│     │  • Paso 1: Modelo de IA                 │                         │
│     │  • Paso 2: Datos del negocio            │                         │
│     │  • Paso 3: Conectar WhatsApp/Telegram   │                         │
│     │  • Paso 4: Crear empleados/roles        │                         │
│     └─────────────────────────────────────────┘                         │
│                         │                                               │
│                         ▼                                               │
│  5. USO DIARIO (Contenedor Agento)                                      │
│     ┌─────────────────────────────────────────┐                         │
│     │  • Chat con el agente                   │                         │
│     │  • Gestión de empleados                 │                         │
│     │  • Conectar más canales                 │                         │
│     │  • Ver métricas y logs                  │                         │
│     │  • Configurar herramientas              │                         │
│     │  • TODO dentro de su contenedor         │                         │
│     └─────────────────────────────────────────┘                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Arquitectura Corregida (Laravel con DB + Agente Monitoreo)

### 2.1 Visión General

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                 VPS HOSTINGER                               │
│                                    8GB RAM                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         TRAEFIK                                      │   │
│  │                    (*.misaas.com)                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│         ┌──────────────────────────┼──────────────────────────────┐        │
│         │                          │                              │        │
│         ▼                          ▼                              ▼        │
│  ┌──────────────┐    ┌────────────────────────┐    ┌──────────────────┐   │
│  │   LARAVEL    │    │    CONTENEDORES        │    │  AGENTE VPS      │   │
│  │   (SaaS)     │    │    DE CLIENTES         │    │  (Monitoreo)     │   │
│  │              │    │                        │    │                  │   │
│  │ app.misaas.  │    │  ┌─────┐ ┌─────┐ ...   │    │ monitor.misaas.  │   │
│  │    com       │    │  │ C1  │ │ C2  │       │    │     com          │   │
│  │              │    │  └─────┘ └─────┘       │    │                  │   │
│  │ CON MySQL    │    │                        │    │ • Health checks  │   │
│  │ CON Redis    │    │  Agento completo       │    │ • Auto-restart   │   │
│  │              │    │  de cada cliente       │    │ • Alertas        │   │
│  └──────────────┘    └────────────────────────┘    │ • Logs          │   │
│         │                                          └──────────────────┘   │
│         │                                                   │             │
│         ▼                                                   │             │
│  ┌──────────────┐                                           │             │
│  │    MySQL     │◄──────────────────────────────────────────┘             │
│  │    Redis     │     (Agente puede consultar estado de clientes)         │
│  └──────────────┘                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Laravel SaaS (CON Base de Datos)

Laravel **SÍ tiene su propia base de datos** para manejar:

```sql
-- Tablas del SaaS (en MySQL del VPS)
users                 -- Usuarios del SaaS (clientes que pagan)
subscriptions         -- Suscripciones activas
payments              -- Historial de pagos
tenants               -- Mapeo usuario → contenedor
containers            -- Estado de cada contenedor Docker
support_tickets       -- Tickets de soporte
activity_logs         -- Actividad de usuarios
notifications         -- Notificaciones enviadas
```

### 2.3 Docker Compose Completo

```yaml
# /opt/wrapper/docker-compose.yml
version: "3.8"

networks:
  web_network:
    external: true
  internal_network:
    internal: true

volumes:
  mysql_data:
  redis_data:

services:
  # ===================== TRAEFIK =====================
  traefik:
    image: traefik:v3.0
    container_name: wrapper_traefik
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik/traefik.yml:/traefik.yml:ro
      - ./traefik/acme:/acme
    networks:
      - web_network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.traefik.rule=Host(`traefik.misaas.com`)"
      - "traefik.http.routers.traefik.tls.certresolver=letsencrypt"

  # ===================== LARAVEL SAAS =====================
  laravel:
    build:
      context: ./laravel
      dockerfile: Dockerfile
    container_name: wrapper_laravel
    restart: unless-stopped
    networks:
      - web_network
      - internal_network
    volumes:
      - ./laravel:/var/www/html
      - ./tenants:/var/www/tenants
      - /var/run/docker.sock:/var/run/docker.sock:ro
    environment:
      - APP_ENV=production
      - APP_URL=https://app.misaas.com
      - DB_HOST=mysql
      - DB_DATABASE=wrapper_saas
      - DB_USERNAME=wrapper
      - DB_PASSWORD=${DB_PASSWORD}
      - REDIS_HOST=redis
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.laravel.rule=Host(`app.misaas.com`,`www.misaas.com`,`misaas.com`)"
      - "traefik.http.routers.laravel.tls.certresolver=letsencrypt"
      - "traefik.http.services.laravel.loadbalancer.server.port=80"
    depends_on:
      - mysql
      - redis

  # ===================== MYSQL (Para Laravel) =====================
  mysql:
    image: mysql:8.0
    container_name: wrapper_mysql
    restart: unless-stopped
    networks:
      - internal_network
    volumes:
      - mysql_data:/var/lib/mysql
      - ./mysql/init:/docker-entrypoint-initdb.d
    environment:
      - MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
      - MYSQL_DATABASE=wrapper_saas
      - MYSQL_USER=wrapper
      - MYSQL_PASSWORD=${DB_PASSWORD}

  # ===================== REDIS =====================
  redis:
    image: redis:7-alpine
    container_name: wrapper_redis
    restart: unless-stopped
    networks:
      - internal_network
    volumes:
      - redis_data:/data

  # ===================== AGENTE MONITOREO VPS =====================
  vps-monitor:
    build:
      context: ./agent-vps
      dockerfile: Dockerfile
    container_name: wrapper_monitor
    restart: unless-stopped
    networks:
      - web_network
      - internal_network
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./tenants:/var/www/tenants:ro
      - ./logs:/var/log/agent
    environment:
      - AGENT_MODE=monitor
      - ALERT_EMAIL=admin@misaas.com
      - ALERT_TELEGRAM_BOT=${MONITOR_BOT_TOKEN}
      - ALERT_TELEGRAM_CHAT=${ADMIN_CHAT_ID}
      - DB_HOST=mysql
      - DB_DATABASE=wrapper_saas
      - DB_USERNAME=wrapper
      - DB_PASSWORD=${DB_PASSWORD}
      - MAX_RAM_PERCENT=85
      - MAX_DISK_PERCENT=80
      - AUTO_RESTART_FAILED=true
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.monitor.rule=Host(`monitor.misaas.com`)"
      - "traefik.http.routers.monitor.tls.certresolver=letsencrypt"
    depends_on:
      - mysql
      - laravel
```

---

## 2B. Agente de Monitoreo del VPS

### 2B.1 Responsabilidades del Agente

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AGENTE MONITOR VPS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   MONITOREO CONTINUO (cada 30 segundos):                                    │
│   ├── RAM del VPS (% usado)                                                │
│   ├── CPU del VPS (% usado)                                                │
│   ├── Disco (% usado)                                                      │
│   ├── Estado de cada contenedor cliente                                    │
│   ├── Conectividad de canales (WhatsApp, Telegram)                         │
│   └── Logs de errores                                                      │
│                                                                             │
│   ACCIONES AUTOMÁTICAS:                                                     │
│   ├── Si RAM > 85% → Reiniciar contenedor más pesado inactivo              │
│   ├── Si contenedor caído → Intentar reiniciar 3 veces                     │
│   ├── Si reinicios fallan → Notificar admin + suspender                    │
│   ├── Si disco > 80% → Limpiar logs antiguos                               │
│   └── Si SSL por vencer → Renovar certificado                              │
│                                                                             │
│   ALERTAS:                                                                  │
│   ├── Email al admin                                                        │
│   ├── Telegram al canal de admin                                           │
│   ├── SMS (opcional, crítico)                                              │
│   └── Log en dashboard del SaaS                                            │
│                                                                             │
│   REPORTES DIARIOS:                                                         │
│   ├── Resumen de salud del VPS                                             │
│   ├── Contenedores activos/inactivos                                       │
│   ├── Uso de recursos por cliente                                          │
│   └── Incidentes del día                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2B.2 Código del Agente Monitor

```typescript
// agent-vps/src/monitor.ts

import Docker from "dockerode";
import { Client as MySQLClient } from "mysql2/promise";
import Redis from "ioredis";
import nodemailer from "nodemailer";
import TelegramBot from "node-telegram-bot-api";

interface VPSMetrics {
  timestamp: Date;
  cpu_percent: number;
  memory_percent: number;
  memory_used: number;
  memory_total: number;
  disk_percent: number;
  disk_used: number;
  disk_total: number;
  containers_total: number;
  containers_running: number;
  containers_stopped: number;
}

interface ContainerHealth {
  id: string;
  name: string;
  status: "running" | "stopped" | "unhealthy";
  memory_usage: number;
  cpu_usage: number;
  uptime_seconds: number;
  last_error?: string;
}

class VPSMonitorAgent {
  private docker: Docker;
  private db: MySQLClient;
  private redis: Redis;
  private telegram: TelegramBot;
  private emailTransporter: nodemailer.Transporter;

  // Umbrales de alerta
  private thresholds = {
    max_ram_percent: parseInt(process.env.MAX_RAM_PERCENT || "85"),
    max_disk_percent: parseInt(process.env.MAX_DISK_PERCENT || "80"),
    max_cpu_percent: parseInt(process.env.MAX_CPU_PERCENT || "90"),
    auto_restart_failed: process.env.AUTO_RESTART_FAILED === "true",
  };

  // Estado interno
  private restartAttempts: Map<string, number> = new Map();
  private alertsSent: Set<string> = new Set();

  constructor() {
    this.docker = new Docker({ socketPath: "/var/run/docker.sock" });
    // ... init DB, Redis, Telegram, Email
  }

  async start() {
    console.log("🔍 VPS Monitor Agent iniciado");

    // Monitoreo cada 30 segundos
    setInterval(() => this.monitor(), 30_000);

    // Health check completo cada 5 minutos
    setInterval(() => this.fullHealthCheck(), 300_000);

    // Reporte diario a las 8 AM
    this.scheduleDailyReport(8, 0);

    // Monitoreo inicial
    await this.monitor();
  }

  private async monitor(): Promise<void> {
    try {
      // 1. Obtener métricas del VPS
      const metrics = await this.getVPSMetrics();

      // 2. Obtener estado de contenedores
      const containers = await this.getContainersHealth();

      // 3. Guardar métricas en DB
      await this.saveMetrics(metrics, containers);

      // 4. Verificar umbrales y actuar
      await this.checkThresholds(metrics, containers);

      // 5. Actualizar dashboard
      await this.updateDashboard(metrics, containers);

    } catch (error) {
      console.error("Error en monitoreo:", error);
      await this.sendAlert("error", `Error en monitoreo: ${error}`);
    }
  }

  private async getVPSMetrics(): Promise<VPSMetrics> {
    // Leer /proc/meminfo para memoria
    const memInfo = await fs.readFile("/proc/meminfo", "utf-8");
    const memTotal = this.parseKV(memInfo, "MemTotal");
    const memAvailable = this.parseKV(memInfo, "MemAvailable");
    const memUsed = memTotal - memAvailable;

    // Leer /proc/stat para CPU
    const cpuPercent = await this.getCPUUsage();

    // Leer df para disco
    const diskInfo = await this.getDiskUsage();

    // Contar contenedores
    const allContainers = await this.docker.listContainers({ all: true });
    const running = allContainers.filter(c => c.State === "running");

    return {
      timestamp: new Date(),
      cpu_percent: cpuPercent,
      memory_percent: (memUsed / memTotal) * 100,
      memory_used: memUsed,
      memory_total: memTotal,
      disk_percent: diskInfo.percent,
      disk_used: diskInfo.used,
      disk_total: diskInfo.total,
      containers_total: allContainers.length,
      containers_running: running.length,
      containers_stopped: allContainers.length - running.length,
    };
  }

  private async getContainersHealth(): Promise<ContainerHealth[]> {
    const containers = await this.docker.listContainers({ all: true });
    const health: ContainerHealth[] = [];

    for (const container of containers) {
      // Solo monitorear contenedores de clientes (agento_*)
      if (!container.Names.some(n => n.startsWith("/agento_"))) {
        continue;
      }

      const inspect = await this.docker.getContainer(container.Id).inspect();
      const stats = await this.docker.getContainer(container.Id).stats({ stream: false });

      health.push({
        id: container.Id.substring(0, 12),
        name: container.Names[0].replace("/", ""),
        status: container.State as "running" | "stopped" | "unhealthy",
        memory_usage: stats.memory_stats.usage || 0,
        cpu_usage: this.calculateCPUPercent(stats),
        uptime_seconds: inspect.State.StartedAt
          ? (Date.now() - new Date(inspect.State.StartedAt).getTime()) / 1000
          : 0,
        last_error: inspect.State.Error || undefined,
      });
    }

    return health;
  }

  private async checkThresholds(
    metrics: VPSMetrics,
    containers: ContainerHealth[]
  ): Promise<void> {
    const alerts: string[] = [];

    // Verificar RAM
    if (metrics.memory_percent > this.thresholds.max_ram_percent) {
      alerts.push(`⚠️ RAM al ${metrics.memory_percent.toFixed(1)}%`);

      // Acción automática: reiniciar contenedor más pesado inactivo
      if (this.thresholds.auto_restart_failed) {
        await this.freeUpMemory(containers);
      }
    }

    // Verificar disco
    if (metrics.disk_percent > this.thresholds.max_disk_percent) {
      alerts.push(`⚠️ Disco al ${metrics.disk_percent.toFixed(1)}%`);
      await this.cleanupDisk();
    }

    // Verificar contenedores caídos
    const stoppedContainers = containers.filter(c => c.status === "stopped");
    for (const container of stoppedContainers) {
      const attempts = this.restartAttempts.get(container.id) || 0;

      if (attempts < 3) {
        console.log(`Intentando reiniciar ${container.name} (intento ${attempts + 1})`);
        await this.restartContainer(container);
        this.restartAttempts.set(container.id, attempts + 1);
      } else {
        alerts.push(`❌ ${container.name} no pudo reiniciarse después de 3 intentos`);
        await this.suspendTenant(container.name);
      }
    }

    // Enviar alertas si hay
    if (alerts.length > 0) {
      await this.sendAlert("warning", alerts.join("\n"));
    }

    // Limpiar intentos de contenedores que ya están corriendo
    for (const container of containers.filter(c => c.status === "running")) {
      this.restartAttempts.delete(container.id);
    }
  }

  private async freeUpMemory(containers: ContainerHealth[]): Promise<void> {
    // Encontrar el contenedor que más memoria usa y está inactivo
    // (sin conexiones activas en los últimos 10 minutos)

    const db = await this.db.getConnection();
    const [rows] = await db.query(`
      SELECT c.container_id, c.tenant_id, c.last_activity
      FROM containers c
      WHERE c.status = 'running'
      AND c.last_activity < DATE_SUB(NOW(), INTERVAL 10 MINUTE)
      ORDER BY c.memory_usage DESC
      LIMIT 1
    `);

    if (rows.length > 0) {
      const containerToStop = rows[0];
      console.log(`🛑 Deteniendo contenedor inactivo: ${containerToStop.container_id}`);

      try {
        await this.docker.getContainer(containerToStop.container_id).stop();
        await this.sendAlert("info",
          `Contenedor ${containerToStop.container_id} detenido por uso de memoria. ` +
          `El cliente no tuvo actividad en 10+ minutos.`
        );
      } catch (error) {
        console.error("Error deteniendo contenedor:", error);
      }
    }
  }

  private async restartContainer(container: ContainerHealth): Promise<boolean> {
    try {
      const dockerContainer = this.docker.getContainer(container.id);
      await dockerContainer.restart();
      console.log(`✅ Contenedor ${container.name} reiniciado`);
      return true;
    } catch (error) {
      console.error(`Error reiniciando ${container.name}:`, error);
      return false;
    }
  }

  private async suspendTenant(containerName: string): Promise<void> {
    // Extraer tenant UUID del nombre (agento_{uuid})
    const tenantId = containerName.replace("agento_", "");

    // Actualizar estado en DB
    await this.db.query(`
      UPDATE tenants SET status = 'suspended', suspended_at = NOW()
      WHERE uuid = ?
    `, [tenantId]);

    // Notificar al cliente por email
    const [tenant] = await this.db.query(`
      SELECT t.subdomain, u.email, u.name
      FROM tenants t
      JOIN users u ON t.user_id = u.id
      WHERE t.uuid = ?
    `, [tenantId]);

    if (tenant) {
      await this.sendEmail(tenant.email,
        "Tu agente ha sido suspendido",
        `Hola ${tenant.name},\n\nTu agente tuvo problemas y no pudo reiniciarse. ` +
        `Por favor contactá a soporte.\n\nEl equipo de Wrapper`
      );
    }

    await this.sendAlert("critical",
      `🚨 Tenant ${tenantId} SUSPENDIDO - No se pudo recuperar el contenedor`
    );
  }

  private async cleanupDisk(): Promise<void> {
    console.log("🧹 Limpiando disco...");

    // 1. Limpiar logs antiguos (> 7 días)
    await exec("find /var/log -name '*.log' -mtime +7 -delete");

    // 2. Limpiar caches de Docker
    await this.docker.pruneContainers();
    await this.docker.pruneImages({ filters: { dangling: { true: true } } });

    // 3. Limpiar backups temporales
    await exec("find /opt/wrapper/backups -name '*.tmp' -delete");

    const diskInfo = await this.getDiskUsage();
    await this.sendAlert("info",
      `Limpieza de disco completada. Espacio liberado. ` +
      `Uso actual: ${diskInfo.percent.toFixed(1)}%`
    );
  }

  private async sendAlert(level: "info" | "warning" | "error" | "critical", message: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const alertKey = `${level}:${message.substring(0, 50)}`;

    // Evitar spam de alertas repetidas (max 1 por hora por tipo)
    if (this.alertsSent.has(alertKey)) {
      const lastSent = await this.redis.get(`alert:${alertKey}`);
      if (lastSent && Date.now() - parseInt(lastSent) < 3600000) {
        return;
      }
    }

    // Enviar por Telegram
    const emoji = { info: "ℹ️", warning: "⚠️", error: "❌", critical: "🚨" }[level];
    await this.telegram.sendMessage(
      process.env.ALERT_TELEGRAM_CHAT!,
      `${emoji} [${level.toUpperCase()}] ${timestamp}\n\n${message}`
    );

    // Enviar por email si es crítico
    if (level === "critical" || level === "error") {
      await this.sendEmail(process.env.ALERT_EMAIL!, `[Wrapper Alert] ${level}`, message);
    }

    // Guardar en DB
    await this.db.query(`
      INSERT INTO alerts (level, message, created_at)
      VALUES (?, ?, NOW())
    `, [level, message]);

    // Marcar como enviada
    this.alertsSent.add(alertKey);
    await this.redis.set(`alert:${alertKey}`, Date.now().toString(), "EX", 3600);
  }

  private async scheduleDailyReport(hour: number, minute: number): Promise<void> {
    const now = new Date();
    const target = new Date(now);
    target.setHours(hour, minute, 0, 0);

    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }

    const delay = target.getTime() - now.getTime();

    setTimeout(async () => {
      await this.sendDailyReport();
      // Reprogramar para el próximo día
      setInterval(() => this.sendDailyReport(), 24 * 60 * 60 * 1000);
    }, delay);
  }

  private async sendDailyReport(): Promise<void> {
    // Obtener métricas del día
    const [metrics] = await this.db.query(`
      SELECT
        AVG(memory_percent) as avg_memory,
        MAX(memory_percent) as max_memory,
        AVG(cpu_percent) as avg_cpu,
        COUNT(*) as total_checks
      FROM vps_metrics
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 1 DAY)
    `);

    const [incidents] = await this.db.query(`
      SELECT level, COUNT(*) as count
      FROM alerts
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
      GROUP BY level
    `);

    const [containers] = await this.db.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
        SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) as suspended
      FROM tenants
    `);

    const report = `
📊 **REPORTE DIARIO - Wrapper SaaS**
${new Date().toLocaleDateString("es-AR")}

🖥️ **VPS:**
• RAM promedio: ${metrics.avg_memory?.toFixed(1)}%
• RAM máximo: ${metrics.max_memory?.toFixed(1)}%
• CPU promedio: ${metrics.avg_cpu?.toFixed(1)}%

📦 **Contenedores:**
• Total: ${containers.total}
• Activos: ${containers.running}
• Suspendidos: ${containers.suspended}

⚠️ **Incidentes:**
${incidents.map((i: any) => `• ${i.level}: ${i.count}`).join("\n") || "• Ninguno"}

---
Generado automáticamente por el Agente Monitor
    `;

    await this.telegram.sendMessage(process.env.ALERT_TELEGRAM_CHAT!, report);
  }
}

// Iniciar el agente
const agent = new VPSMonitorAgent();
agent.start();
```

### 2B.3 Dashboard del Agente (Web UI)

```tsx
// El agente tiene su propia UI en monitor.misaas.com
// Muestra en tiempo real el estado del VPS

export default function MonitorDashboard() {
  const [metrics, setMetrics] = useState(null);
  const [containers, setContainers] = useState([]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch('/api/monitor/status');
      const data = await res.json();
      setMetrics(data.metrics);
      setContainers(data.containers);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">🖥️ VPS Monitor</h1>

      {/* Métricas principales */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="RAM"
          value={`${metrics?.memory_percent?.toFixed(1)}%`}
          status={metrics?.memory_percent > 85 ? "danger" : "ok"}
        />
        <MetricCard title="CPU" value={`${metrics?.cpu_percent?.toFixed(1)}%`} />
        <MetricCard title="Disco" value={`${metrics?.disk_percent?.toFixed(1)}%`} />
        <MetricCard title="Contenedores" value={`${metrics?.containers_running}/${metrics?.containers_total}`} />
      </div>

      {/* Lista de contenedores */}
      <div className="bg-white rounded-lg shadow">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-3">Contenedor</th>
              <th className="text-left p-3">Estado</th>
              <th className="text-left p-3">RAM</th>
              <th className="text-left p-3">CPU</th>
              <th className="text-left p-3">Uptime</th>
              <th className="text-left p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {containers.map((c: any) => (
              <tr key={c.id} className="border-b">
                <td className="p-3">{c.name}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-sm ${
                    c.status === 'running' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {c.status}
                  </span>
                </td>
                <td className="p-3">{formatBytes(c.memory_usage)}</td>
                <td className="p-3">{c.cpu_usage.toFixed(1)}%</td>
                <td className="p-3">{formatUptime(c.uptime_seconds)}</td>
                <td className="p-3">
                  <button onClick={() => restartContainer(c.id)} className="text-blue-500 mr-2">
                    Reiniciar
                  </button>
                  <button onClick={() => stopContainer(c.id)} className="text-red-500">
                    Detener
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

## 2C. WhatsApp Business API Oficial (Meta Cloud API)

### 2C.1 Diferencia: Baileys vs Cloud API

| Aspecto | Baileys (Actual) | Cloud API (Meta) |
|---------|------------------|------------------|
| **Costo** | Gratis | Gratis primeras 1000 conversaciones/mes |
| **Límites** | Sin límite oficial | Rate limits claros |
| **Estabilidad** | Puede romperse | API oficial, estable |
| **Verificación** | No requiere | Requiere Business verification |
| **Números** | Cualquier WhatsApp | Número Business dedicado |
| **Webhook** | Conexión persistente | HTTP webhook |
| **Riesgo de ban** | Alto | Bajo (si seguís reglas) |

### 2C.2 Implementación en Agento

```typescript
// src/channels/whatsapp-cloud/index.ts

import { Router } from "express";

interface WhatsAppCloudConfig {
  phone_number_id: string;
  business_account_id: string;
  access_token: string;
  webhook_verify_token: string;
  app_secret: string;
}

export class WhatsAppCloudChannel {
  private config: WhatsAppCloudConfig;
  private router: Router;

  constructor(config: WhatsAppCloudConfig) {
    this.config = config;
    this.router = Router();
    this.setupWebhook();
  }

  private setupWebhook() {
    // Verificación del webhook (Meta lo llama al configurar)
    this.router.get("/webhook", (req, res) => {
      const mode = req.query["hub.mode"];
      const token = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];

      if (mode === "subscribe" && token === this.config.webhook_verify_token) {
        console.log("Webhook verificado");
        res.status(200).send(challenge);
      } else {
        res.sendStatus(403);
      }
    });

    // Recibir mensajes
    this.router.post("/webhook", async (req, res) => {
      const body = req.body;

      if (body.object === "whatsapp_business_account") {
        for (const entry of body.entry) {
          for (const change of entry.changes) {
            if (change.field === "messages") {
              await this.processMessage(change.value);
            }
          }
        }
        res.sendStatus(200);
      } else {
        res.sendStatus(404);
      }
    });
  }

  private async processMessage(value: any) {
    const message = value.messages?.[0];
    if (!message) return;

    const from = message.from; // Número del cliente
    const type = message.type;
    const timestamp = new Date(parseInt(message.timestamp) * 1000);

    let content: string;
    let mediaUrl: string | undefined;

    switch (type) {
      case "text":
        content = message.text.body;
        break;
      case "image":
        content = message.image.caption || "[Imagen]";
        mediaUrl = await this.getMediaUrl(message.image.id);
        break;
      case "audio":
        content = "[Audio]";
        mediaUrl = await this.getMediaUrl(message.audio.id);
        break;
      default:
        content = `[${type}]`;
    }

    // Enviar al agente
    await this.deliverToAgent({
      channel: "whatsapp",
      accountId: this.config.phone_number_id,
      from,
      content,
      mediaUrl,
      timestamp,
      raw: message,
    });
  }

  async sendMessage(to: string, text: string): Promise<void> {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${this.config.phone_number_id}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.config.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: to,
          type: "text",
          text: { preview_url: false, body: text },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`);
    }
  }

  async sendTemplate(to: string, templateName: string, params: string[]): Promise<void> {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${this.config.phone_number_id}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.config.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: to,
          type: "template",
          template: {
            name: templateName,
            language: { code: "es_AR" },
            components: [
              {
                type: "body",
                parameters: params.map(p => ({ type: "text", text: p })),
              },
            ],
          },
        }),
      }
    );

    // ...
  }

  private async getMediaUrl(mediaId: string): Promise<string> {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${mediaId}`,
      {
        headers: { "Authorization": `Bearer ${this.config.access_token}` },
      }
    );
    const data = await response.json();
    return data.url;
  }

  getWebhookRouter(): Router {
    return this.router;
  }
}
```

### 2C.3 Configuración en el Wizard

```tsx
// Paso de WhatsApp Cloud en el wizard

function WhatsAppCloudStep() {
  const [step, setStep] = useState<'choose' | 'cloud' | 'baileys'>('choose');
  const [config, setConfig] = useState({
    phone_number_id: '',
    access_token: '',
    webhook_verify_token: '',
  });

  return (
    <div>
      <h2>Conectar WhatsApp</h2>

      {step === 'choose' && (
        <div className="space-y-4">
          <button
            onClick={() => setStep('cloud')}
            className="w-full p-4 border rounded-lg text-left"
          >
            <div className="font-medium">📱 WhatsApp Business API (Recomendado)</div>
            <div className="text-sm text-gray-600">
              API oficial de Meta. Más estable, sin riesgo de ban.
              Requiere cuenta Business verificada.
            </div>
          </button>

          <button
            onClick={() => setStep('baileys')}
            className="w-full p-4 border rounded-lg text-left"
          >
            <div className="font-medium">💬 WhatsApp Personal (Experimental)</div>
            <div className="text-sm text-gray-600">
              Usa tu WhatsApp personal. Puede ser inestable.
              No recomendado para producción.
            </div>
          </button>
        </div>
      )}

      {step === 'cloud' && (
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg text-sm">
            <strong>Configuración requerida en Meta Business Suite:</strong>
            <ol className="list-decimal ml-4 mt-2 space-y-1">
              <li>Ir a developers.facebook.com</li>
              <li>Crear app de tipo Business</li>
              <li>Agregar producto WhatsApp Business API</li>
              <li>Copiar Phone Number ID y Access Token</li>
              <li>Configurar webhook con la URL que te daremos</li>
            </ol>
          </div>

          <input
            placeholder="Phone Number ID"
            value={config.phone_number_id}
            onChange={e => setConfig({...config, phone_number_id: e.target.value})}
            className="w-full border rounded p-3"
          />

          <input
            placeholder="Access Token"
            value={config.access_token}
            onChange={e => setConfig({...config, access_token: e.target.value})}
            className="w-full border rounded p-3"
          />

          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm font-medium">Tu URL de Webhook:</p>
            <code className="text-sm bg-white p-2 rounded block mt-1">
              https://{tenantSubdomain}.misaas.com/api/whatsapp/webhook
            </code>
            <p className="text-xs text-gray-500 mt-2">
              Verify Token: <code>{config.webhook_verify_token || 'generar...'}</code>
            </p>
          </div>

          <button
            onClick={handleVerify}
            className="w-full py-3 bg-green-500 text-white rounded"
          >
            Verificar Conexión
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## 3. Infraestructura

### 2.1 Servidor Hostinger

| Recurso | Especificación |
|---------|----------------|
| OS | Ubuntu 22.04 LTS |
| RAM | 8 GB |
| CPU | 4 vCPU |
| Disco | 100 GB SSD |
| Docker | 24.x |
| Docker Compose | 2.x |

### 2.2 Stack Tecnológico del SaaS

| Componente | Tecnología |
|------------|------------|
| Backend SaaS | Laravel 11 |
| Frontend SaaS | React + Inertia.js |
| Base de datos | MySQL 8.0 |
| Cache/Queue | Redis |
| Proxy | Traefik 3.x |
| Contenedor Agentes | Agento (OpenClaw fork) |
| Pagos | Stripe + MercadoPago |

---

## 3. Configuración de Traefik

### 3.1 Estructura de Directorios

```
/opt/wrapper/
├── docker-compose.yml          # Stack principal
├── traefik/
│   ├── traefik.yml             # Configuración estática
│   ├── dynamic/
│   │   └── middleware.yml      # Configuración dinámica
│   └── acme/
│       └── acme.json           # Certificados SSL
├── laravel/
│   └── (aplicación SaaS)
├── tenants/
│   ├── {uuid-cliente-a}/
│   │   ├── data/               # Persistencia Agento
│   │   └── config/
│   └── {uuid-cliente-b}/
│       ├── data/
│       └── config/
└── mysql/
    └── data/
```

### 3.2 docker-compose.yml (Stack Principal)

```yaml
# /opt/wrapper/docker-compose.yml
version: "3.8"

networks:
  web_network:
    external: true
  internal_network:
    internal: true

services:
  # ===================== TRAEFIK =====================
  traefik:
    image: traefik:v3.0
    container_name: wrapper_traefik
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"  # Dashboard (cerrar en producción)
    volumes:
      - /etc/localtime:/etc/localtime:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik/traefik.yml:/traefik.yml:ro
      - ./traefik/dynamic:/dynamic:ro
      - ./traefik/acme/acme.json:/acme.json
    networks:
      - web_network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.traefik.entrypoints=websecure"
      - "traefik.http.routers.traefik.rule=Host(`traefik.misaas.com`)"
      - "traefik.http.routers.traefik.tls.certresolver=letsencrypt"
      - "traefik.http.routers.traefik.service=api@internal"
      - "traefik.http.routers.traefik.middlewares=authtraefik"
      # Middleware de autenticación para dashboard
      - "traefik.http.middlewares.authtraefik.basicauth.users=admin:$$apr1$$..."

  # ===================== LARAVEL SAAS =====================
  laravel:
    build:
      context: ./laravel
      dockerfile: Dockerfile
    container_name: wrapper_laravel
    restart: unless-stopped
    networks:
      - web_network
      - internal_network
    volumes:
      - ./laravel:/var/www/html
      - ./tenants:/var/www/tenants
      - /var/run/docker.sock:/var/run/docker.sock:ro  # Para controlar Docker
    environment:
      - APP_ENV=production
      - APP_URL=https://app.misaas.com
      - DB_HOST=mysql
      - DB_DATABASE=wrapper_saas
      - DB_USERNAME=wrapper
      - DB_PASSWORD=${DB_PASSWORD}
      - REDIS_HOST=redis
      - STRIPE_KEY=${STRIPE_KEY}
      - STRIPE_SECRET=${STRIPE_SECRET}
      - MERCADOPAGO_ACCESS_TOKEN=${MP_ACCESS_TOKEN}
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.laravel.rule=Host(`app.misaas.com`)"
      - "traefik.http.routers.laravel.entrypoints=websecure"
      - "traefik.http.routers.laravel.tls.certresolver=letsencrypt"
      - "traefik.http.services.laravel.loadbalancer.server.port=80"
    depends_on:
      - mysql
      - redis

  # ===================== MYSQL =====================
  mysql:
    image: mysql:8.0
    container_name: wrapper_mysql
    restart: unless-stopped
    networks:
      - internal_network
    volumes:
      - ./mysql/data:/var/lib/mysql
    environment:
      - MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
      - MYSQL_DATABASE=wrapper_saas
      - MYSQL_USER=wrapper
      - MYSQL_PASSWORD=${DB_PASSWORD}

  # ===================== REDIS =====================
  redis:
    image: redis:7-alpine
    container_name: wrapper_redis
    restart: unless-stopped
    networks:
      - internal_network
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

### 3.3 traefik.yml (Configuración Estática)

```yaml
# /opt/wrapper/traefik/traefik.yml
api:
  dashboard: true
  insecure: false

entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
  websecure:
    address: ":443"

providers:
  docker:
    endpoint: "unix:///var/run/docker.sock"
    exposedByDefault: false
    network: web_network
  file:
    directory: /dynamic
    watch: true

certificatesResolvers:
  letsencrypt:
    acme:
      email: admin@misaas.com
      storage: acme.json
      httpChallenge:
        entryPoint: web
```

---

## 4. DockerAgentService (Laravel)

### 4.1 Instalación de Dependencias

```bash
composer require spatie/docker
```

### 4.2 Servicio DockerAgentService

```php
<?php

namespace App\Services;

use App\Models\User;
use App\Models\Tenant;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Spatie\Docker\Docker;
use Spatie\Docker\DockerContainer;

class DockerAgentService
{
    private Docker $docker;
    private string $networkName = 'web_network';
    private string $baseDomain = 'misaas.com';
    private string $agentImage = 'agento:latest';
    private string $tenantsPath = '/var/www/tenants';

    public function __construct()
    {
        $this->docker = Docker::create();
    }

    /**
     * Despliega una nueva instancia de Agento para un usuario
     */
    public function deployAgent(User $user): Tenant
    {
        // Crear o obtener tenant
        $tenant = Tenant::firstOrCreate(
            ['user_id' => $user->id],
            [
                'uuid' => Str::uuid(),
                'subdomain' => $this->generateSubdomain($user),
                'status' => 'provisioning',
            ]
        );

        // Si ya está corriendo, retornar
        if ($tenant->status === 'running') {
            return $tenant;
        }

        // Crear directorios de persistencia
        $this->createTenantDirectories($tenant);

        // Construir nombre del contenedor
        $containerName = "agento_{$tenant->uuid}";

        // Construir comando docker run
        $command = $this->buildDockerRunCommand($tenant, $containerName);

        // Ejecutar comando
        $result = $this->executeDockerCommand($command);

        if ($result['success']) {
            $tenant->update([
                'status' => 'running',
                'container_id' => $result['container_id'] ?? null,
                'url' => "https://{$tenant->subdomain}.{$this->baseDomain}",
            ]);

            Log::info("Agent deployed for user {$user->id}", [
                'tenant' => $tenant->uuid,
                'url' => $tenant->url,
            ]);
        } else {
            $tenant->update(['status' => 'error']);
            Log::error("Failed to deploy agent for user {$user->id}", [
                'error' => $result['error'],
            ]);
        }

        return $tenant;
    }

    /**
     * Detiene el agente de un usuario
     */
    public function stopAgent(User $user): bool
    {
        $tenant = $user->tenant;

        if (!$tenant || $tenant->status !== 'running') {
            return false;
        }

        $containerName = "agento_{$tenant->uuid}";

        $result = $this->executeDockerCommand("docker stop {$containerName}");

        if ($result['success']) {
            $tenant->update(['status' => 'stopped']);
            return true;
        }

        return false;
    }

    /**
     * Reinicia el agente de un usuario
     */
    public function restartAgent(User $user): bool
    {
        $tenant = $user->tenant;

        if (!$tenant) {
            return false;
        }

        $containerName = "agento_{$tenant->uuid}";

        $result = $this->executeDockerCommand("docker restart {$containerName}");

        if ($result['success']) {
            $tenant->update(['status' => 'running']);
            return true;
        }

        return false;
    }

    /**
     * Elimina el contenedor del agente
     */
    public function destroyAgent(User $user): bool
    {
        $tenant = $user->tenant;

        if (!$tenant) {
            return false;
        }

        $containerName = "agento_{$tenant->uuid}";

        // Detener y eliminar contenedor
        $this->executeDockerCommand("docker stop {$containerName}");
        $result = $this->executeDockerCommand("docker rm {$containerName}");

        if ($result['success']) {
            $tenant->update(['status' => 'destroyed']);
            return true;
        }

        return false;
    }

    /**
     * Construye el comando docker run completo
     */
    private function buildDockerRunCommand(Tenant $tenant, string $containerName): string
    {
        $dataPath = "{$this->tenantsPath}/{$tenant->uuid}/data";
        $configPath = "{$this->tenantsPath}/{$tenant->uuid}/config";
        $subdomain = $tenant->subdomain;

        return sprintf(
            'docker run -d --name %s ' .
            '--network %s ' .
            '--memory="512m" --cpus="0.5" ' .
            '-v %s:/app/data ' .
            '-v %s:/app/config ' .
            '-e AGENTO_API_KEY=%s ' .
            '-e AGENTO_GATEWAY_TOKEN=%s ' .
            '-e AGENTO_DEFAULT_MODEL=%s ' .
            '-e AGENTO_BUSINESS_NAME="%s" ' .
            '--label "traefik.enable=true" ' .
            '--label "traefik.http.routers.agent_%s.rule=Host(`%s.%s`)" ' .
            '--label "traefik.http.routers.agent_%s.entrypoints=websecure" ' .
            '--label "traefik.http.routers.agent_%s.tls.certresolver=letsencrypt" ' .
            '--label "traefik.http.services.agent_%s.loadbalancer.server.port=18789" ' .
            '%s',
            $containerName,
            $this->networkName,
            $dataPath,
            $configPath,
            $tenant->api_key,
            $tenant->gateway_token,
            $tenant->default_model ?? 'deepseek/deepseek-chat',
            addslashes($tenant->business_name ?? 'Mi Negocio'),
            $tenant->uuid,
            $subdomain,
            $this->baseDomain,
            $tenant->uuid,
            $tenant->uuid,
            $tenant->uuid,
            $this->agentImage
        );
    }

    /**
     * Crea los directorios de persistencia para un tenant
     */
    private function createTenantDirectories(Tenant $tenant): void
    {
        $basePath = "{$this->tenantsPath}/{$tenant->uuid}";

        // Crear directorios
        if (!is_dir("{$basePath}/data")) {
            mkdir("{$basePath}/data", 0755, true);
        }
        if (!is_dir("{$basePath}/config")) {
            mkdir("{$basePath}/config", 0755, true);
        }

        // Crear archivo de configuración inicial
        $this->createInitialConfig($tenant);
    }

    /**
     * Crea la configuración inicial de Agento
     */
    private function createInitialConfig(Tenant $tenant): void
    {
        $configPath = "{$this->tenantsPath}/{$tenant->uuid}/config/agento.json";

        $config = [
            'gateway' => [
                'port' => 18789,
                'mode' => 'local',
                'bind' => 'loopback',
                'auth' => [
                    'mode' => 'token',
                    'token' => $tenant->gateway_token,
                    'requireLocalAuth' => true,
                ],
            ],
            'agents' => [
                'defaults' => [
                    'model' => [
                        'primary' => $tenant->default_model ?? 'deepseek/deepseek-chat',
                        'fallbacks' => [],
                    ],
                ],
            ],
            'enterprise' => [
                'personality' => [
                    'businessName' => $tenant->business_name ?? 'Mi Negocio',
                    'businessType' => $tenant->business_type ?? 'retail',
                    'businessDescription' => $tenant->business_description ?? '',
                    'sales' => [
                        'name' => 'Ana',
                        'tone' => 'friendly',
                        'expertise' => ['productos', 'precios', 'stock'],
                        'restrictions' => ['No modificar precios sin autorización'],
                    ],
                    'admin' => [
                        'name' => 'Admin',
                        'capabilities' => ['Gestión completa'],
                        'escalationTriggers' => ['urgente', 'hablar con humano'],
                    ],
                ],
                'features' => [
                    'dualPersonality' => true,
                    'securityAlerts' => true,
                    'escalationEnabled' => true,
                ],
            ],
        ];

        file_put_contents($configPath, json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    /**
     * Genera un subdominio único para el usuario
     */
    private function generateSubdomain(User $user): string
    {
        // Usar parte del nombre o generar uno aleatorio
        $base = Str::slug($user->name ?? 'cliente');
        $suffix = Str::random(4);

        return "{$base}-{$suffix}";
    }

    /**
     * Ejecuta un comando de Docker
     */
    private function executeDockerCommand(string $command): array
    {
        $output = [];
        $returnCode = 0;

        exec($command . ' 2>&1', $output, $returnCode);

        $outputString = implode("\n", $output);

        if ($returnCode === 0) {
            // Extraer container ID si es docker run
            $containerId = null;
            if (str_starts_with($command, 'docker run')) {
                $containerId = trim($outputString);
            }

            return [
                'success' => true,
                'output' => $outputString,
                'container_id' => $containerId,
            ];
        }

        return [
            'success' => false,
            'error' => $outputString,
        ];
    }

    /**
     * Obtiene el estado del contenedor
     */
    public function getContainerStatus(Tenant $tenant): array
    {
        $containerName = "agento_{$tenant->uuid}";

        $result = $this->executeDockerCommand(
            "docker inspect --format='{{json .State}}' {$containerName}"
        );

        if ($result['success']) {
            return json_decode($result['output'], true);
        }

        return ['status' => 'not_found'];
    }

    /**
     * Obtiene métricas del contenedor
     */
    public function getContainerStats(Tenant $tenant): array
    {
        $containerName = "agento_{$tenant->uuid}";

        $result = $this->executeDockerCommand(
            "docker stats {$containerName} --no-stream --format '{{json .}}'"
        );

        if ($result['success']) {
            return json_decode($result['output'], true);
        }

        return [];
    }
}
```

### 4.3 Modelo Tenant

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Tenant extends Model
{
    protected $fillable = [
        'user_id',
        'uuid',
        'subdomain',
        'status',
        'container_id',
        'api_key',
        'gateway_token',
        'default_model',
        'business_name',
        'business_type',
        'business_description',
        'url',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($tenant) {
            if (empty($tenant->api_key)) {
                $tenant->api_key = Str::random(32);
            }
            if (empty($tenant->gateway_token)) {
                $tenant->gateway_token = 'sk-' . Str::random(48);
            }
        });
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
```

### 4.4 Controlador

```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\DockerAgentService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class AgentController extends Controller
{
    private DockerAgentService $dockerService;

    public function __construct(DockerAgentService $dockerService)
    {
        $this->dockerService = $dockerService;
    }

    /**
     * POST /api/agent/deploy
     * Despliega una nueva instancia de Agento
     */
    public function deploy(Request $request): JsonResponse
    {
        $user = $request->user();

        // Verificar que el usuario tiene suscripción activa
        if (!$user->hasActiveSubscription()) {
            return response()->json([
                'success' => false,
                'message' => 'Se requiere una suscripción activa',
            ], 402);
        }

        try {
            $tenant = $this->dockerService->deployAgent($user);

            return response()->json([
                'success' => true,
                'message' => 'Agente desplegado exitosamente',
                'data' => [
                    'url' => $tenant->url,
                    'api_key' => $tenant->api_key,
                    'gateway_token' => $tenant->gateway_token,
                    'status' => $tenant->status,
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al desplegar el agente',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * POST /api/agent/stop
     * Detiene el agente
     */
    public function stop(Request $request): JsonResponse
    {
        $success = $this->dockerService->stopAgent($request->user());

        return response()->json([
            'success' => $success,
            'message' => $success ? 'Agente detenido' : 'No se pudo detener el agente',
        ]);
    }

    /**
     * POST /api/agent/restart
     * Reinicia el agente
     */
    public function restart(Request $request): JsonResponse
    {
        $success = $this->dockerService->restartAgent($request->user());

        return response()->json([
            'success' => $success,
            'message' => $success ? 'Agente reiniciado' : 'No se pudo reiniciar el agente',
        ]);
    }

    /**
     * GET /api/agent/status
     * Obtiene el estado del agente
     */
    public function status(Request $request): JsonResponse
    {
        $user = $request->user();
        $tenant = $user->tenant;

        if (!$tenant) {
            return response()->json([
                'success' => false,
                'message' => 'No tienes un agente desplegado',
            ], 404);
        }

        $containerStatus = $this->dockerService->getContainerStatus($tenant);
        $stats = $this->dockerService->getContainerStats($tenant);

        return response()->json([
            'success' => true,
            'data' => [
                'tenant' => $tenant,
                'container' => $containerStatus,
                'stats' => $stats,
            ],
        ]);
    }

    /**
     * DELETE /api/agent/destroy
     * Elimina el agente y sus datos
     */
    public function destroy(Request $request): JsonResponse
    {
        $success = $this->dockerService->destroyAgent($request->user());

        return response()->json([
            'success' => $success,
            'message' => $success ? 'Agente eliminado' : 'No se pudo eliminar el agente',
        ]);
    }
}
```

---

## 5. Seguridad: Permisos Docker

### 5.1 Opción A: Usuario www-data en grupo docker

```bash
# Agregar www-data al grupo docker
sudo usermod -aG docker www-data

# Reiniciar PHP-FPM
sudo systemctl restart php8.2-fpm
```

**Riesgo**: `www-data` tiene acceso completo al Docker socket.

### 5.2 Opción B: Docker Socket Proxy (RECOMENDADO)

```yaml
# Agregar al docker-compose.yml
services:
  docker-proxy:
    image: tecnativa/docker-socket-proxy
    container_name: wrapper_docker_proxy
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    environment:
      - CONTAINERS=1
      - SERVICES=1
      - TASKS=1
      - IMAGES=1
      - NETWORKS=1
      - VOLUMES=0
      - POST=0  # Deshabilitar creación de recursos
      - DELETE=0
    networks:
      - internal_network
```

Laravel se conecta al proxy en lugar del socket directo:

```php
// En DockerAgentService
$this->docker = Docker::create('tcp://docker-proxy:2375');
```

### 5.3 Opción C: API Remota Docker con TLS

Más seguro pero más complejo de configurar.

---

## 6. Wizard Web Simplificado (Para el SaaS)

### 6.1 Flujo del Wizard Web

Cuando un cliente accede por primera vez a su instancia:

```
┌─────────────────────────────────────────────────────────────────┐
│  🎉 ¡Bienvenido a tu Asistente de IA!                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Configura tu asistente en 3 simples pasos:                    │
│                                                                 │
│  Paso 1 de 3: Modelo de IA                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ◉ DeepSeek (Recomendado - Económico)                    │   │
│  │ ○ OpenAI GPT-4 (Mejor calidad)                          │   │
│  │ ○ Anthropic Claude (Más seguro)                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [Siguiente →]                                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Componente React del Wizard

```tsx
// resources/js/components/SetupWizard.tsx
import React, { useState } from 'react';
import { router } from '@inertiajs/react';

interface WizardStep {
  id: number;
  title: string;
  description: string;
}

const steps: WizardStep[] = [
  { id: 1, title: 'Modelo de IA', description: 'Selecciona el proveedor' },
  { id: 2, title: 'Tu Negocio', description: 'Información básica' },
  { id: 3, title: 'Telegram', description: 'Conecta tu bot' },
];

export default function SetupWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    model: 'deepseek',
    business_name: '',
    business_type: 'retail',
    telegram_token: '',
  });

  const handleSubmit = () => {
    router.post('/api/setup/complete', formData, {
      onSuccess: () => {
        window.location.href = '/chat';
      },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full">
        {/* Progress */}
        <div className="flex mb-8">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`flex-1 h-2 mx-1 rounded ${
                step.id <= currentStep ? 'bg-blue-500' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Model */}
        {currentStep === 1 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Selecciona tu Modelo de IA</h2>
            <div className="space-y-3">
              {[
                { id: 'deepseek', name: 'DeepSeek', desc: 'Económico y eficiente', price: '~$0.001/mensaje' },
                { id: 'openai', name: 'OpenAI GPT-4', desc: 'Máxima calidad', price: '~$0.03/mensaje' },
                { id: 'anthropic', name: 'Claude', desc: 'Más seguro', price: '~$0.015/mensaje' },
              ].map((model) => (
                <label
                  key={model.id}
                  className={`block p-4 rounded-lg border-2 cursor-pointer ${
                    formData.model === model.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="model"
                    value={model.id}
                    checked={formData.model === model.id}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="hidden"
                  />
                  <div className="font-semibold">{model.name}</div>
                  <div className="text-sm text-gray-600">{model.desc}</div>
                  <div className="text-xs text-gray-400">{model.price}</div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Business */}
        {currentStep === 2 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Cuéntanos sobre tu Negocio</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre del Negocio</label>
                <input
                  type="text"
                  value={formData.business_name}
                  onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                  className="w-full border rounded-lg p-3"
                  placeholder="Mi Tienda"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tipo de Negocio</label>
                <select
                  value={formData.business_type}
                  onChange={(e) => setFormData({ ...formData, business_type: e.target.value })}
                  className="w-full border rounded-lg p-3"
                >
                  <option value="retail">Tienda / Retail</option>
                  <option value="services">Servicios</option>
                  <option value="consulting">Consultoría</option>
                  <option value="healthcare">Salud</option>
                  <option value="education">Educación</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Telegram */}
        {currentStep === 3 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Conecta tu Bot de Telegram</h2>
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <p className="text-sm text-gray-600 mb-2">¿Cómo obtener el token?</p>
              <ol className="text-sm space-y-1">
                <li>1. Abre Telegram y busca <strong>@BotFather</strong></li>
                <li>2. Envía <code>/newbot</code></li>
                <li>3. Sigue las instrucciones</li>
                <li>4. Copia el token aquí abajo</li>
              </ol>
            </div>
            <input
              type="text"
              value={formData.telegram_token}
              onChange={(e) => setFormData({ ...formData, telegram_token: e.target.value })}
              className="w-full border rounded-lg p-3"
              placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxyz"
            />
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <button
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            className={`px-4 py-2 rounded-lg ${currentStep === 1 ? 'invisible' : ''}`}
            disabled={currentStep === 1}
          >
            ← Anterior
          </button>

          {currentStep < 3 ? (
            <button
              onClick={() => setCurrentStep(currentStep + 1)}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg"
            >
              Siguiente →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="px-6 py-2 bg-green-500 text-white rounded-lg"
            >
              ¡Configurar! 🚀
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## 7. Dockerfile de Agento (Para el SaaS)

```dockerfile
# Dockerfile para Agento en el SaaS
FROM node:22-alpine

WORKDIR /app

# Instalar dependencias del sistema
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Copiar archivos de la aplicación
COPY package.json pnpm-lock.yaml ./
COPY dist ./dist
COPY agento.mjs ./

# Instalar pnpm y dependencias
RUN npm install -g pnpm@10.23.0
RUN pnpm install --prod

# Crear directorio de datos
RUN mkdir -p /app/data /app/config

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV AGENTO_PORT=18789

# Exponer puertos
EXPOSE 18789

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:18789/api/health || exit 1

# Comando de inicio
CMD ["node", "agento.mjs", "gateway", "--port", "18789"]
```

---

## 8. Flujo de Pago y Activación

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUJO DE SUSCRIPCIÓN                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Usuario se registra en app.misaas.com                       │
│  2. Selecciona plan (Básico, Pro, Enterprise)                   │
│  3. Paga con Stripe/MercadoPago                                 │
│  4. Webhook confirma pago                                       │
│  5. Laravel crea Tenant + genera credenciales                   │
│  6. Laravel llama DockerAgentService::deployAgent()             │
│  7. Se despliega contenedor en clienteXXX.misaas.com            │
│  8. Email de bienvenida con URL y tokens                        │
│  9. Usuario accede y completa wizard web                        │
│ 10. ¡Listo para usar!                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Planes y Precios: Modelo "LLM Incluido"

### 9.1 Concepto

En lugar de que el cliente traiga su propia API key, **nosotros incluimos el LLM** usando proveedores chinos económicos pero potentes.

### 9.2 Comparativa de Costos de LLM

| Proveedor | Modelo | Costo Input | Costo Output | Calidad |
|-----------|--------|-------------|--------------|---------|
| **DeepSeek** | deepseek-chat | $0.14/1M tokens | $0.28/1M tokens | ⭐⭐⭐⭐⭐ |
| **DeepSeek** | deepseek-reasoner | $0.55/1M tokens | $2.19/1M tokens | ⭐⭐⭐⭐⭐ |
| **Qwen** | qwen-turbo | $0.05/1M tokens | $0.05/1M tokens | ⭐⭐⭐⭐ |
| **GLM (Z.ai)** | glm-4 | $0.14/1M tokens | $0.14/1M tokens | ⭐⭐⭐⭐ |
| **Moonshot** | kimi | $0.12/1M tokens | $0.12/1M tokens | ⭐⭐⭐⭐ |
| OpenAI | gpt-4o | $2.50/1M tokens | $10.00/1M tokens | ⭐⭐⭐⭐⭐ |
| Anthropic | claude-sonnet | $3.00/1M tokens | $15.00/1M tokens | ⭐⭐⭐⭐⭐ |

**DeepSeek es ~18x más barato que OpenAI GPT-4o** con calidad comparable.

### 9.3 Uso Promedio por Cliente

```
Escenario: Tienda pequeña con WhatsApp de ventas

Mensajes por día: 50 conversaciones × 10 turnos = 500 mensajes
Tokens por mensaje (promedio): 500 tokens input + 200 tokens output = 700 tokens
Tokens por día: 500 × 700 = 350,000 tokens
Tokens por mes: 350,000 × 30 = 10,500,000 tokens (10.5M)

Costo con DeepSeek:
- Input:  10.5M × 0.5 × $0.14/1M = $0.74
- Output: 10.5M × 0.5 × $0.28/1M = $1.47
- Total: ~$2.21 USD/mes en LLM

Costo con OpenAI GPT-4o:
- Input:  5.25M × $2.50/1M = $13.13
- Output: 5.25M × $10.00/1M = $52.50
- Total: ~$65.63 USD/mes en LLM
```

### 9.4 Planes con LLM Incluido

| Plan | Precio/mes | Recursos | LLM Incluido | Mensajes/mes |
|------|------------|----------|--------------|--------------|
| **Starter** | $29 USD | 512MB, 0.5 CPU | DeepSeek Chat | ~5,000 |
| **Básico** | $49 USD | 1GB, 1 CPU | DeepSeek Chat | ~15,000 |
| **Pro** | $79 USD | 1.5GB, 1 CPU | DeepSeek Chat | ~40,000 |
| **Enterprise** | $149 USD | 2GB, 2 CPU | DeepSeek Reasoner | Ilimitado |
| **BYOK** | $19+ USD | Variable | Trae tu API key | Ilimitado |

### 9.5 Margen de Ganancia

```
Plan Básico ($49/mes):

Costos:
- VPS (prorrateado, 10 clientes): $3
- DeepSeek LLM: $5 (promedio)
- Stripe fee (2.9%): $1.42
- Margen de seguridad LLM: $5
─────────────────────────────────
Costo total: ~$14.42

Ganancia: $49 - $14.42 = $34.58 (70% margen)
```

```
Plan Pro ($79/mes):

Costos:
- VPS (prorrateado, 6 clientes Pro): $4
- DeepSeek LLM: $10 (promedio)
- Stripe fee: $2.29
- Margen de seguridad: $8
─────────────────────────────────
Costo total: ~$24.29

Ganancia: $79 - $24.29 = $54.71 (69% margen)
```

### 9.6 Estrategia de LLM por Nivel

```typescript
// Configuración automática según plan
const LLM_CONFIG_BY_PLAN = {
  starter: {
    provider: "deepseek",
    model: "deepseek/deepseek-chat",
    max_tokens_per_month: 5_000_000,  // ~5M tokens
    rate_limit: "10 requests/minute",
  },
  basico: {
    provider: "deepseek",
    model: "deepseek/deepseek-chat",
    max_tokens_per_month: 15_000_000,  // ~15M tokens
    rate_limit: "30 requests/minute",
  },
  pro: {
    provider: "deepseek",
    model: "deepseek/deepseek-chat",
    max_tokens_per_month: 40_000_000,  // ~40M tokens
    rate_limit: "60 requests/minute",
  },
  enterprise: {
    provider: "deepseek",
    model: "deepseek/deepseek-reasoner",  // Modelo más potente
    max_tokens_per_month: null,  // Ilimitado
    rate_limit: null,
    fallback: "deepseek/deepseek-chat",  // Si reasoner falla
  },
  byok: {
    // Bring Your Own Key - cliente configura su proveedor
    provider: null,
    model: null,
    custom: true,
  },
};
```

### 9.7 Implementación: API Key Compartida

```typescript
// En el contenedor del cliente, NO guardamos la API key real
// Sino que hacemos proxy a través de nuestro servidor

// agento.json del contenedor cliente:
{
  "agents": {
    "defaults": {
      "model": {
        "provider": "wrapper-proxy",  // Proxy nuestro
        "model": "deepseek-chat",
        "endpoint": "https://llm-proxy.misaas.com/v1"
      }
    }
  }
}

// El cliente nunca ve la API key real de DeepSeek
```

```typescript
// llm-proxy/src/proxy.ts (Servicio aparte)

import express from "express";
import rateLimit from "express-rate-limit";

const app = express();

// Rate limiter por tenant
const limiters = new Map<string, rateLimit.RateLimit>();

app.use(async (req, res, next) => {
  // Obtener tenant del header
  const tenantId = req.headers["x-tenant-id"] as string;
  const plan = await getTenantPlan(tenantId);
  const config = LLM_CONFIG_BY_PLAN[plan];

  // Verificar límite mensual
  const usage = await getMonthlyUsage(tenantId);
  if (config.max_tokens_per_month && usage > config.max_tokens_per_month) {
    return res.status(429).json({
      error: "Límite mensual alcanzado",
      upgrade_url: "https://app.misaas.com/upgrade"
    });
  }

  // Aplicar rate limit
  let limiter = limiters.get(tenantId);
  if (!limiter) {
    limiter = rateLimit({
      windowMs: 60_000,
      max: parseInt(config.rate_limit?.split("/")[0] || "60"),
      keyGenerator: () => tenantId,
    });
    limiters.set(tenantId, limiter);
  }

  limiter(req, res, async () => {
    // Proxy a DeepSeek con nuestra API key
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    // Registrar uso
    const tokensUsed = data.usage?.total_tokens || 0;
    await recordUsage(tenantId, tokensUsed);

    res.json(data);
  });
});

app.listen(3000);
```

### 9.8 Dashboard de Uso para el Cliente

```tsx
// El cliente ve su uso de tokens en su panel

function UsageDashboard() {
  const [usage, setUsage] = useState(null);

  return (
    <div className="p-6">
      <h2>📊 Uso de tu Asistente</h2>

      <div className="grid grid-cols-3 gap-4 mt-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">Mensajes este mes</div>
          <div className="text-2xl font-bold">{usage?.messages || 0}</div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">Tokens usados</div>
          <div className="text-2xl font-bold">
            {formatNumber(usage?.tokens || 0)} / {formatNumber(usage?.limit || "∞")}
          </div>
          <div className="w-full bg-gray-200 rounded h-2 mt-2">
            <div
              className="bg-blue-500 h-2 rounded"
              style={{ width: `${(usage.tokens / usage.limit) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">Plan actual</div>
          <div className="text-2xl font-bold">{usage?.plan}</div>
          <a href="/upgrade" className="text-blue-500 text-sm">Subir de plan →</a>
        </div>
      </div>

      {usage.tokens / usage.limit > 0.8 && (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mt-4">
          ⚠️ Te estás acercando al límite mensual. Considera subir de plan
          para evitar interrupciones.
        </div>
      )}
    </div>
  );
}
```

### 9.9 Ventajas del Modelo "LLM Incluido"

| Para el Cliente | Para Vos |
|-----------------|----------|
| ✅ No busca API key | ✅ Controlás el costo |
| ✅ Setup más rápido | ✅ Margen alto (70%+) |
| ✅ Un solo pago | ✅ Fidelización |
| ✅ Soporte incluido | ✅ Diferenciación vs competencia |
| ✅ Sin sorpresas de factura | ✅ Escalabilidad predecible |

### 9.10 Costo de DeepSeek para el SaaS

```
Contratando volumen con DeepSeek:

Uso mensual estimado con 20 clientes activos:
- Promedio 10M tokens/cliente/mes
- Total: 200M tokens/mes

Costo DeepSeek:
- Input (50%):  100M × $0.14/1M = $14
- Output (50%): 100M × $0.28/1M = $28
- Total: $42 USD/mes

Ingresos con 20 clientes:
- 10 × Básico $49 = $490
- 6 × Pro $79 = $474
- 4 × Enterprise $149 = $596
- Total: $1,560 USD/mes

Margen: $1,560 - $42 (LLM) - $50 (VPS) = $1,468 USD/mes
```

### 9.11 Fallback y Redundancia

```typescript
// Si DeepSeek falla, cambiar a otro proveedor chino

const PROVIDERS = [
  { name: "deepseek", priority: 1, healthy: true },
  { name: "qwen", priority: 2, healthy: true },
  { name: "glm", priority: 3, healthy: true },
  { name: "moonshot", priority: 4, healthy: true },
];

async function callLLM(messages: Message[], tenantId: string): Promise<Response> {
  for (const provider of PROVIDERS.sort((a, b) => a.priority - b.priority)) {
    if (!provider.healthy) continue;

    try {
      const response = await fetchProvider(provider.name, messages);
      return response;
    } catch (error) {
      console.error(`${provider.name} failed:`, error);
      provider.healthy = false;

      // Reintentar con siguiente proveedor
      continue;
    }
  }

  throw new Error("Todos los proveedores de LLM están caídos");
}

// Health check cada minuto
setInterval(async () => {
  for (const provider of PROVIDERS) {
    try {
      await testProvider(provider.name);
      provider.healthy = true;
    } catch {
      provider.healthy = false;
    }
  }
}, 60_000);
```

---

## 10. Roadmap de Implementación

### Fase 1: Infraestructura Base (Semana 1-2)
- [ ] Configurar VPS Hostinger
- [ ] Instalar Docker + Docker Compose
- [ ] Configurar Traefik con SSL
- [ ] Crear red `web_network`
- [ ] Probar con contenedor de prueba

### Fase 2: SaaS Backend (Semana 3-4)
- [ ] Crear proyecto Laravel
- [ ] Implementar modelos User, Tenant, Subscription
- [ ] Integrar Stripe + MercadoPago
- [ ] Implementar DockerAgentService
- [ ] Crear API endpoints

### Fase 3: Integración Agento (Semana 5-6)
- [ ] Crear Dockerfile de Agento para SaaS
- [ ] Probar despliegue automático
- [ ] Implementar wizard web simplificado
- [ ] Configurar persistencia de datos

### Fase 4: Frontend y UX (Semana 7-8)
- [ ] Dashboard de usuario (React)
- [ ] Wizard de configuración web
- [ ] Panel de métricas y uso
- [ ] Sistema de tickets/soporte

### Fase 5: Testing y Launch (Semana 9-10)
- [ ] Tests automatizados
- [ ] Load testing
- [ ] Documentación de usuario
- [ ] Soft launch
- [ ] Iterar basado en feedback

---

## 11. Consideraciones Adicionales

### 11.1 Backup y Recuperación
```bash
# Script de backup diario
#!/bin/bash
DATE=$(date +%Y%m%d)
tar -czf /backups/tenants_$DATE.tar.gz /opt/wrapper/tenants/
mysqldump -u root -p$MYSQL_ROOT_PASSWORD wrapper_saas > /backups/db_$DATE.sql
# Subir a S3/Backblaze
```

### 11.2 Monitoreo
- Prometheus + Grafana para métricas
- Alertas de uso de recursos por contenedor
- Logs centralizados con Loki

### 11.3 Escalabilidad
Cuando el VPS se quede corto:
1. Migrar a Kubernetes (k3s)
2. Usar múltiples VPS con Docker Swarm
3. Usar proveedor de nube (DigitalOcean, AWS)

---

## 12. Agento: Sistema Interno del Contenedor

### 12.1 Almacenamiento (Sin Base de Datos SQL)

Agento usa **solo archivos** para persistencia. Todo se guarda en el workspace:

```
/workspace/
├── config/
│   ├── agento.json           # Configuración principal
│   ├── users.json            # Usuarios/empleados del tenant
│   ├── roles.json            # Definición de roles y permisos
│   └── channels.json         # Configuración de canales
│
├── data/
│   ├── sessions/             # Historiales de conversación (Markdown)
│   │   ├── whatsapp_ventas/
│   │   ├── telegram_admin/
│   │   └── web_contabilidad/
│   │
│   ├── memory/               # Memoria del agente (Markdown)
│   │   ├── facts.md          # Hechos sobre el negocio
│   │   ├── clients.md        # Información de clientes
│   │   └── procedures.md     # Procedimientos internos
│   │
│   ├── documentos/           # Archivos del negocio
│   │   ├── facturas/
│   │   ├── contratos/
│   │   └── catalogo/
│   │
│   └── employees/            # Datos de empleados
│       ├── maria.json
│       ├── carlos.json
│       └── ana.json
│
├── skills/                   # Skills instaladas
│   └── session-memory/
│
└── logs/                     # Logs del sistema
    ├── gateway.log
    └── agent.log
```

### 12.2 Sistema de Usuarios Interno (users.json)

```json
{
  "owner": {
    "id": "owner_001",
    "email": "juan@mitienda.com",
    "name": "Juan Pérez",
    "role": "owner",
    "password_hash": "$2b$12$...",
    "created_at": "2026-02-14T10:00:00Z",
    "last_login": "2026-02-14T15:30:00Z"
  },
  "employees": [
    {
      "id": "emp_001",
      "email": "maria@mitienda.com",
      "name": "María García",
      "role": "accountant",
      "password_hash": "$2b$12$...",
      "channels": ["web", "slack"],
      "agent_bindings": {
        "web": "contabilidad",
        "slack": "contabilidad"
      },
      "permissions": {
        "filesystem": {
          "read": ["/data/documentos/*", "/data/facturas/*"],
          "write": ["/data/facturas/*"],
          "deny": ["/config/*", "/data/ventas/*"]
        },
        "tools": ["crear_factura", "ver_stock", "exportar_excel"]
      },
      "created_at": "2026-02-15T09:00:00Z",
      "is_active": true
    },
    {
      "id": "emp_002",
      "email": "ana@mitienda.com",
      "name": "Ana López",
      "role": "sales",
      "password_hash": "$2b$12$...",
      "channels": ["whatsapp"],
      "agent_bindings": {
        "whatsapp": "ventas"
      },
      "permissions": {
        "filesystem": {
          "read": ["/data/catalogo/*"],
          "write": [],
          "deny": ["/data/facturas/*", "/data/clientes/*"]
        },
        "tools": ["consultar_stock", "consultar_precio", "crear_pedido"]
      },
      "created_at": "2026-02-15T10:00:00Z",
      "is_active": true
    }
  ]
}
```

### 12.3 Definición de Roles (roles.json)

```json
{
  "roles": {
    "owner": {
      "description": "Dueño del negocio, acceso total",
      "permissions": {
        "filesystem": {
          "read": ["/*"],
          "write": ["/*"],
          "delete": ["/*"]
        },
        "tools": ["*"],
        "admin": true
      }
    },
    "manager": {
      "description": "Supervisor, casi todo excepto configuración crítica",
      "permissions": {
        "filesystem": {
          "read": ["/*"],
          "write": ["/data/*"],
          "delete": ["/data/*"]
        },
        "tools": ["*"],
        "admin": false,
        "deny": ["/config/agento.json"]
      }
    },
    "accountant": {
      "description": "Contabilidad y administración",
      "permissions": {
        "filesystem": {
          "read": ["/data/documentos/*", "/data/facturas/*", "/data/stock/*"],
          "write": ["/data/documentos/*", "/data/facturas/*"],
          "delete": ["/data/facturas/borradores/*"]
        },
        "tools": [
          "crear_factura",
          "modificar_factura",
          "ver_stock",
          "exportar_excel",
          "enviar_email"
        ]
      }
    },
    "sales": {
      "description": "Ventas y atención al público",
      "permissions": {
        "filesystem": {
          "read": ["/data/catalogo/*"],
          "write": [],
          "delete": []
        },
        "tools": [
          "consultar_stock",
          "consultar_precio",
          "crear_pedido",
          "ver_estado_pedido"
        ]
      }
    },
    "support": {
      "description": "Soporte técnico",
      "permissions": {
        "filesystem": {
          "read": ["/data/tickets/*", "/data/manuales/*"],
          "write": ["/data/tickets/*"],
          "delete": []
        },
        "tools": [
          "crear_ticket",
          "cerrar_ticket",
          "ver_historial_cliente"
        ]
      }
    }
  }
}
```

### 12.4 Autenticación Interna de Agento

```typescript
// src/auth/internal-auth.ts

import bcrypt from "bcrypt";
import fs from "fs/promises";
import path from "path";

const USERS_FILE = "/workspace/config/users.json";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  password_hash: string;
  channels: string[];
  permissions: Permissions;
  is_active: boolean;
}

export class InternalAuth {
  private users: { owner: User; employees: User[] } | null = null;

  async loadUsers(): Promise<void> {
    const content = await fs.readFile(USERS_FILE, "utf-8");
    this.users = JSON.parse(content);
  }

  async saveUsers(): Promise<void> {
    await fs.writeFile(USERS_FILE, JSON.stringify(this.users, null, 2));
  }

  async authenticate(email: string, password: string): Promise<User | null> {
    await this.loadUsers();

    // Check owner
    if (this.users!.owner.email === email) {
      const valid = await bcrypt.compare(password, this.users!.owner.password_hash);
      if (valid) return this.users!.owner;
    }

    // Check employees
    for (const emp of this.users!.employees) {
      if (emp.email === email && emp.is_active) {
        const valid = await bcrypt.compare(password, emp.password_hash);
        if (valid) return emp;
      }
    }

    return null;
  }

  async createEmployee(data: {
    email: string;
    name: string;
    role: string;
    password: string;
    channels: string[];
  }): Promise<User> {
    await this.loadUsers();

    const password_hash = await bcrypt.hash(data.password, 10);

    const employee: User = {
      id: `emp_${Date.now()}`,
      email: data.email,
      name: data.name,
      role: data.role,
      password_hash,
      channels: data.channels,
      permissions: await this.getRolePermissions(data.role),
      is_active: true,
    };

    this.users!.employees.push(employee);
    await this.saveUsers();

    return employee;
  }

  async getRolePermissions(role: string): Promise<Permissions> {
    const rolesPath = "/workspace/config/roles.json";
    const content = await fs.readFile(rolesPath, "utf-8");
    const roles = JSON.parse(content);
    return roles.roles[role]?.permissions || {};
  }

  hasPermission(user: User, action: string, resource: string): boolean {
    const perms = user.permissions;

    // Check deny first
    if (perms.filesystem?.deny) {
      for (const pattern of perms.filesystem.deny) {
        if (this.matchPattern(pattern, resource)) {
          return false;
        }
      }
    }

    // Check allow
    const [operation, _] = action.split(":"); // "fs:read" -> "fs"
    const fsPerm = perms.filesystem?.[operation === "fs" ? action.split(":")[1] : operation];

    if (fsPerm) {
      for (const pattern of fsPerm) {
        if (pattern === "*" || this.matchPattern(pattern, resource)) {
          return true;
        }
      }
    }

    return false;
  }

  private matchPattern(pattern: string, path: string): boolean {
    const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
    return regex.test(path);
  }
}
```

### 12.5 Middleware de Permisos en Agento

```typescript
// src/agents/filesystem-guard.ts

import { InternalAuth } from "../auth/internal-auth.js";

const auth = new InternalAuth();

export function createFilesystemGuard(userId: string) {
  return {
    async checkRead(filePath: string): Promise<{ allowed: boolean; reason?: string }> {
      const user = await auth.getUserById(userId);
      if (!user) return { allowed: false, reason: "User not found" };

      const allowed = auth.hasPermission(user, "fs:read", filePath);
      return {
        allowed,
        reason: allowed ? undefined : `No tienes permiso para leer ${filePath}`
      };
    },

    async checkWrite(filePath: string): Promise<{ allowed: boolean; reason?: string }> {
      const user = await auth.getUserById(userId);
      if (!user) return { allowed: false, reason: "User not found" };

      const allowed = auth.hasPermission(user, "fs:write", filePath);
      return {
        allowed,
        reason: allowed ? undefined : `No tienes permiso para escribir en ${filePath}`
      };
    },

    async checkDelete(filePath: string): Promise<{ allowed: boolean; reason?: string }> {
      const user = await auth.getUserById(userId);
      if (!user) return { allowed: false, reason: "User not found" };

      const allowed = auth.hasPermission(user, "fs:delete", filePath);
      return {
        allowed,
        reason: allowed ? undefined : `No tienes permiso para eliminar ${filePath}`
      };
    },

    async logAccess(operation: string, filePath: string, success: boolean): Promise<void> {
      const logEntry = {
        timestamp: new Date().toISOString(),
        user_id: userId,
        operation,
        file_path: filePath,
        success,
      };

      // Append to access log
      const logPath = "/workspace/logs/file_access.jsonl";
      await fs.appendFile(logPath, JSON.stringify(logEntry) + "\n");
    }
  };
}
```

---

## 13. Wizard Web de Configuración Inicial (Dentro del Contenedor)

### 13.1 Estructura del Wizard

Este wizard corre **dentro del contenedor de Agento**, no en Laravel.

```typescript
// src/web/setup-wizard/routes.ts

export const SETUP_WIZARD_ROUTES = {
  // Estado del wizard
  GET "/api/setup/status": "getSetupStatus",

  // Pasos del wizard
  POST "/api/setup/step/1/model": "setupModel",
  POST "/api/setup/step/2/business": "setupBusiness",
  POST "/api/setup/step/3/channels": "setupChannels",
  POST "/api/setup/step/4/employees": "setupEmployees",
  POST "/api/setup/complete": "completeSetup",
};
```

### 13.2 Estado del Wizard

```typescript
// src/web/setup-wizard/state.ts

interface WizardState {
  completed: boolean;
  current_step: number;
  steps: {
    model: { completed: boolean; data?: ModelConfig };
    business: { completed: boolean; data?: BusinessConfig };
    channels: { completed: boolean; data?: ChannelsConfig };
    employees: { completed: boolean; data?: EmployeesConfig };
  };
}

// Guardado en: /workspace/config/setup_wizard.json
```

### 13.3 Paso 1: Modelo de IA

```typescript
// POST /api/setup/step/1/model

{
  "provider": "deepseek",
  "api_key": "sk-xxxxx",
  "model": "deepseek/deepseek-chat"
}

// Guarda en:
// - /workspace/config/agento.json → agents.defaults.model
// - /workspace/auth-profiles/deepseek.json → api_key
```

### 13.4 Paso 2: Datos del Negocio

```typescript
// POST /api/setup/step/2/business

{
  "business_name": "Mi Tienda",
  "business_type": "retail",
  "business_description": "Venta de electrónicos",
  "owner_name": "Juan",
  "owner_email": "juan@mitienda.com",
  "owner_password": "secure123"
}

// Guarda en:
// - /workspace/config/agento.json → enterprise.personality
// - /workspace/config/users.json → owner
// - /workspace/data/memory/facts.md → información del negocio
```

### 13.5 Paso 3: Canales

```typescript
// POST /api/setup/step/3/channels

{
  "whatsapp": {
    "enabled": true,
    "phone_number": "+5491112345678",
    "purpose": "Ventas"
    // QR se escanea en el navegador
  },
  "telegram": {
    "enabled": true,
    "bot_token": "123456:ABC...",
    "purpose": "Admin"
  }
}

// Guarda en:
// - /workspace/config/agento.json → channels
```

### 13.6 Paso 4: Empleados (Opcional)

```typescript
// POST /api/setup/step/4/employees

{
  "employees": [
    {
      "name": "María",
      "email": "maria@mitienda.com",
      "password": "maria123",
      "role": "accountant",
      "channels": ["web"]
    },
    {
      "name": "Ana",
      "email": "ana@mitienda.com",
      "password": "ana123",
      "role": "sales",
      "channels": ["whatsapp"]
    }
  ]
}

// Guarda en:
// - /workspace/config/users.json → employees[]
// - /workspace/config/roles.json → permisos según rol
```

### 13.7 Componente React del Wizard (Dentro de Agento)

```tsx
// ui/src/setup-wizard/SetupWizard.tsx

import React, { useState, useEffect } from 'react';

const STEPS = [
  { id: 1, title: 'Modelo de IA', icon: '🤖' },
  { id: 2, title: 'Tu Negocio', icon: '🏪' },
  { id: 3, title: 'Canales', icon: '📱' },
  { id: 4, title: 'Equipo', icon: '👥' },
];

export default function SetupWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [wizardComplete, setWizardComplete] = useState(false);

  // Verificar si ya completó el wizard
  useEffect(() => {
    fetch('/api/setup/status')
      .then(res => res.json())
      .then(data => {
        if (data.completed) {
          setWizardComplete(true);
        } else {
          setCurrentStep(data.current_step);
        }
      });
  }, []);

  if (wizardComplete) {
    return <Navigate to="/chat" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-2xl mx-auto py-12 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            ¡Bienvenido a tu Asistente!
          </h1>
          <p className="text-gray-600 mt-2">
            Configurá tu agente en 4 simples pasos
          </p>
        </div>

        {/* Progress */}
        <div className="flex justify-center mb-8">
          {STEPS.map((step) => (
            <div
              key={step.id}
              className={`flex items-center ${
                step.id < STEPS.length ? 'flex-1' : ''
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  step.id <= currentStep
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {step.icon}
              </div>
              {step.id < STEPS.length && (
                <div
                  className={`flex-1 h-1 mx-2 ${
                    step.id < currentStep ? 'bg-blue-500' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Steps */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {currentStep === 1 && <ModelStep onNext={() => setCurrentStep(2)} />}
          {currentStep === 2 && <BusinessStep onNext={() => setCurrentStep(3)} onBack={() => setCurrentStep(1)} />}
          {currentStep === 3 && <ChannelsStep onNext={() => setCurrentStep(4)} onBack={() => setCurrentStep(2)} />}
          {currentStep === 4 && <EmployeesStep onComplete={() => setWizardComplete(true)} onBack={() => setCurrentStep(3)} />}
        </div>
      </div>
    </div>
  );
}

// Paso 1: Modelo
function ModelStep({ onNext }: { onNext: () => void }) {
  const [provider, setProvider] = useState('deepseek');
  const [apiKey, setApiKey] = useState('');

  const handleSave = async () => {
    await fetch('/api/setup/step/1/model', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, api_key: apiKey }),
    });
    onNext();
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Seleccioná tu Modelo de IA</h2>

      <div className="space-y-3 mb-6">
        {[
          { id: 'deepseek', name: 'DeepSeek', price: '~$0.001/msj', rec: true },
          { id: 'openai', name: 'OpenAI GPT-4', price: '~$0.03/msj' },
          { id: 'anthropic', name: 'Claude', price: '~$0.015/msj' },
        ].map(p => (
          <button
            key={p.id}
            onClick={() => setProvider(p.id)}
            className={`w-full p-4 rounded-lg border-2 text-left ${
              provider === p.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
            }`}
          >
            <div className="font-medium">{p.name} {p.rec && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Recomendado</span>}</div>
            <div className="text-sm text-gray-500">{p.price}</div>
          </button>
        ))}
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium mb-1">API Key</label>
        <input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          className="w-full border rounded-lg p-3"
          placeholder="sk-..."
        />
        <p className="text-xs text-gray-500 mt-1">
          Obtenela en {provider === 'deepseek' ? 'platform.deepseek.com' : provider === 'openai' ? 'platform.openai.com' : 'console.anthropic.com'}
        </p>
      </div>

      <button
        onClick={handleSave}
        disabled={!apiKey}
        className="w-full py-3 bg-blue-500 text-white rounded-lg disabled:opacity-50"
      >
        Siguiente →
      </button>
    </div>
  );
}

// Paso 2: Negocio
function BusinessStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [form, setForm] = useState({
    business_name: '',
    business_type: 'retail',
    owner_name: '',
    owner_email: '',
    owner_password: '',
  });

  const handleSave = async () => {
    await fetch('/api/setup/step/2/business', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    onNext();
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Contanos sobre tu Negocio</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nombre del Negocio</label>
          <input
            type="text"
            value={form.business_name}
            onChange={e => setForm({...form, business_name: e.target.value})}
            className="w-full border rounded-lg p-3"
            placeholder="Mi Tienda"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Tipo de Negocio</label>
          <select
            value={form.business_type}
            onChange={e => setForm({...form, business_type: e.target.value})}
            className="w-full border rounded-lg p-3"
          >
            <option value="retail">Tienda / Retail</option>
            <option value="services">Servicios</option>
            <option value="consulting">Consultoría</option>
            <option value="healthcare">Salud</option>
            <option value="education">Educación</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Tu Nombre</label>
          <input
            type="text"
            value={form.owner_name}
            onChange={e => setForm({...form, owner_name: e.target.value})}
            className="w-full border rounded-lg p-3"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Tu Email (para login)</label>
          <input
            type="email"
            value={form.owner_email}
            onChange={e => setForm({...form, owner_email: e.target.value})}
            className="w-full border rounded-lg p-3"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Contraseña</label>
          <input
            type="password"
            value={form.owner_password}
            onChange={e => setForm({...form, owner_password: e.target.value})}
            className="w-full border rounded-lg p-3"
          />
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={onBack} className="flex-1 py-3 border rounded-lg">
          ← Atrás
        </button>
        <button
          onClick={handleSave}
          disabled={!form.business_name || !form.owner_email || !form.owner_password}
          className="flex-1 py-3 bg-blue-500 text-white rounded-lg disabled:opacity-50"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}

// Paso 3: Canales
function ChannelsStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [telegramToken, setTelegramToken] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [qrCode, setQrCode] = useState('');

  const requestWhatsAppQR = async () => {
    const res = await fetch('/api/channels/whatsapp/qr');
    const data = await res.json();
    setQrCode(data.qr);
    setShowQR(true);
  };

  const handleSave = async () => {
    await fetch('/api/setup/step/3/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegram: { enabled: !!telegramToken, bot_token: telegramToken },
        whatsapp: { enabled: showQR },
      }),
    });
    onNext();
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Conectá tus Canales</h2>

      {/* Telegram */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium mb-2">📱 Telegram (Admin)</h3>
        <p className="text-sm text-gray-600 mb-3">
          Obtené el token en @BotFather con /newbot
        </p>
        <input
          type="text"
          value={telegramToken}
          onChange={e => setTelegramToken(e.target.value)}
          className="w-full border rounded-lg p-3"
          placeholder="123456789:ABCdef..."
        />
      </div>

      {/* WhatsApp */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium mb-2">💬 WhatsApp (Ventas)</h3>
        {!showQR ? (
          <button
            onClick={requestWhatsAppQR}
            className="w-full py-3 bg-green-500 text-white rounded-lg"
          >
            Conectar WhatsApp
          </button>
        ) : (
          <div className="text-center">
            <div className="bg-white p-4 rounded-lg inline-block">
              <pre className="text-xs font-mono">{qrCode}</pre>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Escaneá este código con WhatsApp
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={onBack} className="flex-1 py-3 border rounded-lg">
          ← Atrás
        </button>
        <button
          onClick={handleSave}
          className="flex-1 py-3 bg-blue-500 text-white rounded-lg"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}

// Paso 4: Empleados
function EmployeesStep({ onComplete, onBack }: { onComplete: () => void; onBack: () => void }) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [skipEmployees, setSkipEmployees] = useState(false);

  const addEmployee = () => {
    setEmployees([...employees, { name: '', email: '', role: 'sales', password: '' }]);
  };

  const handleComplete = async () => {
    if (!skipEmployees && employees.length > 0) {
      await fetch('/api/setup/step/4/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employees }),
      });
    }

    await fetch('/api/setup/complete', { method: 'POST' });
    onComplete();
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Agregar Empleados (Opcional)</h2>
      <p className="text-gray-600 mb-4">
        Podés agregar empleados ahora o hacerlo más tarde desde el panel.
      </p>

      {!skipEmployees && (
        <div className="space-y-4 mb-4">
          {employees.map((emp, i) => (
            <div key={i} className="p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-3">
                <input
                  placeholder="Nombre"
                  value={emp.name}
                  onChange={e => {
                    const newEmps = [...employees];
                    newEmps[i].name = e.target.value;
                    setEmployees(newEmps);
                  }}
                  className="border rounded p-2"
                />
                <select
                  value={emp.role}
                  onChange={e => {
                    const newEmps = [...employees];
                    newEmps[i].role = e.target.value;
                    setEmployees(newEmps);
                  }}
                  className="border rounded p-2"
                >
                  <option value="sales">Ventas</option>
                  <option value="support">Soporte</option>
                  <option value="accountant">Contabilidad</option>
                  <option value="manager">Supervisor</option>
                </select>
              </div>
            </div>
          ))}

          <button onClick={addEmployee} className="w-full py-2 border-2 border-dashed rounded-lg text-gray-500">
            + Agregar otro empleado
          </button>
        </div>
      )}

      <label className="flex items-center gap-2 mb-6">
        <input
          type="checkbox"
          checked={skipEmployees}
          onChange={e => setSkipEmployees(e.target.checked)}
        />
        <span className="text-sm text-gray-600">Lo hago después</span>
      </label>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3 border rounded-lg">
          ← Atrás
        </button>
        <button
          onClick={handleComplete}
          className="flex-1 py-3 bg-green-500 text-white rounded-lg"
        >
          ¡Configurar! 🚀
        </button>
      </div>
    </div>
  );
}
```

---

## 14. Sistema Multi-Agente con Roles (Dentro del Contenedor)

Cada tenant puede tener **múltiples agentes** con **roles diferentes**, cada uno accesible desde canales específicos.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TENANT: "Mi Tienda"                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐      │
│   │   AGENTE VENTAS │     │ AGENTE ADMIN    │     │ AGENTE CONTABIL │      │
│   │   (WhatsApp)    │     │   (Telegram)    │     │   (Web/Slack)   │      │
│   ├─────────────────┤     ├─────────────────┤     ├─────────────────┤      │
│   │ Rol: sales      │     │ Rol: admin      │     │ Rol: accountant │      │
│   │ Canal: WhatsApp │     │ Canal: Telegram │     │ Canal: Web      │      │
│   │ Permisos:       │     │ Permisos:       │     │ Permisos:       │      │
│   │  - Consultar    │     │  - Todo         │     │  - /docs/*      │      │
│   │  - Escalar      │     │  - Escalar      │     │  - /facturas/*  │      │
│   │                 │     │  - Configurar   │     │  - Leer stock   │      │
│   │ Restricciones:  │     │                 │     │                 │      │
│   │  - Sin precios  │     │                 │     │ Restricciones:  │      │
│   │  - Sin datos    │     │                 │     │  - Sin ventas   │      │
│   └────────┬────────┘     └────────┬────────┘     └────────┬────────┘      │
│            │                       │                       │               │
│            └───────────────────────┴───────────────────────┘               │
│                                        │                                   │
│                              ┌─────────▼─────────┐                         │
│                              │   WORKSPACE       │                         │
│                              │   /data/          │                         │
│                              │   ├─ ventas/      │                         │
│                              │   ├─ docs/        │                         │
│                              │   ├─ facturas/    │                         │
│                              │   └─ config/      │                         │
│                              └───────────────────┘                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 12.2 Roles Predefinidos

| Rol | Descripción | Canales Típicos | Permisos de Archivos |
|-----|-------------|-----------------|---------------------|
| **sales** | Agente de ventas público | WhatsApp, Instagram | Solo lectura de catálogo |
| **support** | Soporte técnico | WhatsApp, Email | Lectura de tickets |
| **accountant** | Contabilidad/administrativo | Web, Slack | `/docs/*`, `/facturas/*` |
| **manager** | Supervisor | Telegram, Web | Todo excepto config |
| **admin** | Administrador completo | Telegram, Web | Acceso total |

### 12.3 Estructura de Permisos por Archivo

```json
{
  "roles": {
    "sales": {
      "filesystem": {
        "read": ["/data/catalogo/*", "/data/precios/publicos/*"],
        "write": [],
        "delete": []
      },
      "tools": ["consultar_stock", "consultar_precio", "crear_pedido"],
      "restrictions": [
        "No modificar precios",
        "No acceder a datos de clientes",
        "No ver facturas"
      ]
    },
    "accountant": {
      "filesystem": {
        "read": ["/data/docs/*", "/data/facturas/*", "/data/stock/*"],
        "write": ["/data/docs/*", "/data/facturas/*"],
        "delete": ["/data/facturas/borradores/*"]
      },
      "tools": [
        "crear_factura",
        "modificar_factura",
        "ver_stock",
        "exportar_excel"
      ],
      "restrictions": [
        "No acceder a conversaciones de ventas",
        "No modificar configuración del sistema"
      ]
    },
    "admin": {
      "filesystem": {
        "read": ["/*"],
        "write": ["/*"],
        "delete": ["/*"]
      },
      "tools": ["*"],
      "restrictions": []
    }
  }
}
```

### 12.4 Configuración de Agentes (agento.json)

```json5
{
  "agents": {
    "list": [
      {
        "id": "ventas",
        "name": "Ana - Ventas",
        "role": "sales",
        "model": "deepseek/deepseek-chat",
        "personality": {
          "name": "Ana",
          "tone": "friendly",
          "greeting": "¡Hola! Soy Ana, tu asistente de ventas."
        },
        "bindings": {
          "whatsapp": ["ventas"]
        },
        "permissions": {
          "filesystem": {
            "read": ["/data/catalogo/*"],
            "write": [],
            "deny": ["/data/facturas/*", "/data/clientes/*"]
          }
        }
      },
      {
        "id": "admin",
        "name": "Jefe - Administrador",
        "role": "admin",
        "model": "anthropic/claude-opus-4-6",
        "bindings": {
          "telegram": ["main"]
        },
        "permissions": {
          "filesystem": {
            "read": ["/*"],
            "write": ["/*"]
          }
        }
      },
      {
        "id": "contabilidad",
        "name": "Carlos - Contabilidad",
        "role": "accountant",
        "model": "deepseek/deepseek-chat",
        "bindings": {
          "web": ["dashboard"],
          "slack": ["finanzas"]
        },
        "permissions": {
          "filesystem": {
            "read": ["/data/docs/*", "/data/facturas/*", "/data/stock/*"],
            "write": ["/data/docs/*", "/data/facturas/*"],
            "delete": ["/data/facturas/borradores/*"]
          }
        }
      }
    ]
  }
}
```

### 12.5 Routing por Canal

Cuando llega un mensaje, el sistema lo enruta al agente correcto:

```typescript
// src/routing/channel-to-agent.ts

interface ChannelBinding {
  channel: string;
  accountId: string;
  agentId: string;
}

// Tabla de routing
const channelBindings: ChannelBinding[] = [
  // WhatsApp cuenta "ventas" → Agente "ventas"
  { channel: "whatsapp", accountId: "ventas", agentId: "ventas" },
  { channel: "whatsapp", accountId: "soporte", agentId: "soporte" },

  // Telegram bot principal → Agente "admin"
  { channel: "telegram", accountId: "main", agentId: "admin" },

  // Web dashboard → depende del usuario logueado
  { channel: "web", accountId: "dashboard", agentId: "dynamic" },

  // Slack canal finanzas → Agente "contabilidad"
  { channel: "slack", accountId: "finanzas", agentId: "contabilidad" },
];

export function resolveAgentForChannel(
  channel: string,
  accountId: string,
  userId?: string
): string {
  // Para Web, el agente depende del rol del usuario
  if (channel === "web" && userId) {
    return resolveAgentByUserRole(userId);
  }

  const binding = channelBindings.find(
    b => b.channel === channel && b.accountId === accountId
  );

  return binding?.agentId || "default";
}
```

### 12.6 Middleware de Permisos de Archivos

```typescript
// src/agents/filesystem-permissions.ts

import path from "path";

interface FilePermission {
  read: string[];
  write: string[];
  delete: string[];
}

export function checkFilePermission(
  agentRole: string,
  operation: "read" | "write" | "delete",
  filePath: string,
  permissions: FilePermission
): { allowed: boolean; reason?: string } {

  const normalizedPath = path.normalize(filePath);
  const patterns = permissions[operation];

  // Verificar patrones permitidos
  const isAllowed = patterns.some(pattern =>
    matchPattern(pattern, normalizedPath)
  );

  if (!isAllowed) {
    return {
      allowed: false,
      reason: `El rol '${agentRole}' no tiene permiso de ${operation} en ${filePath}`
    };
  }

  // Verificar patrones denegados (deny tiene prioridad)
  const denyPatterns = permissions.deny || [];
  const isDenied = denyPatterns.some(pattern =>
    matchPattern(pattern, normalizedPath)
  );

  if (isDenied) {
    return {
      allowed: false,
      reason: `Acceso denegado a ${filePath} para el rol '${agentRole}'`
    };
  }

  return { allowed: true };
}

function matchPattern(pattern: string, path: string): boolean {
  // Convertir patrón glob a regex
  const regex = pattern
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${regex}$`).test(path);
}
```

### 12.7 Wizard para Agregar Empleados

```tsx
// resources/js/components/AddEmployeeWizard.tsx

import React, { useState } from 'react';

const ROLES = [
  {
    id: 'sales',
    name: 'Ventas',
    description: 'Atención al público, consultas de productos',
    channels: ['WhatsApp'],
    icon: '📱'
  },
  {
    id: 'support',
    name: 'Soporte Técnico',
    description: 'Resolución de problemas técnicos',
    channels: ['WhatsApp', 'Email'],
    icon: '🔧'
  },
  {
    id: 'accountant',
    name: 'Contabilidad',
    description: 'Facturas, documentos, reportes',
    channels: ['Web', 'Slack'],
    icon: '📊'
  },
  {
    id: 'manager',
    name: 'Supervisor',
    description: 'Monitoreo y supervisión',
    channels: ['Telegram', 'Web'],
    icon: '👔'
  },
];

export default function AddEmployeeWizard() {
  const [step, setStep] = useState(1);
  const [employee, setEmployee] = useState({
    name: '',
    role: '',
    channels: [],
    permissions: {
      folders: [],
      tools: [],
    },
  });

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Agregar Empleado / Agente</h1>

      {/* Paso 1: Rol */}
      {step === 1 && (
        <div>
          <h2 className="text-lg font-medium mb-4">¿Qué función tendrá?</h2>
          <div className="grid grid-cols-2 gap-4">
            {ROLES.map((role) => (
              <button
                key={role.id}
                onClick={() => {
                  setEmployee({ ...employee, role: role.id, channels: role.channels });
                  setStep(2);
                }}
                className={`p-4 rounded-lg border-2 text-left hover:border-blue-500 ${
                  employee.role === role.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <div className="text-2xl mb-2">{role.icon}</div>
                <div className="font-semibold">{role.name}</div>
                <div className="text-sm text-gray-600">{role.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Paso 2: Nombre y personalidad */}
      {step === 2 && (
        <div>
          <h2 className="text-lg font-medium mb-4">Personalidad del agente</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nombre del agente</label>
              <input
                type="text"
                value={employee.name}
                onChange={(e) => setEmployee({ ...employee, name: e.target.value })}
                className="w-full border rounded-lg p-3"
                placeholder="Ej: Carlos, María, Asistente..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Canales de acceso</label>
              <div className="flex gap-2">
                {['WhatsApp', 'Telegram', 'Web', 'Slack'].map((ch) => (
                  <label key={ch} className="flex items-center gap-2">
                    <input type="checkbox" />
                    <span>{ch}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-between mt-6">
            <button onClick={() => setStep(1)} className="text-gray-600">← Atrás</button>
            <button
              onClick={() => setStep(3)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}

      {/* Paso 3: Permisos */}
      {step === 3 && (
        <div>
          <h2 className="text-lg font-medium mb-4">Permisos de archivos</h2>

          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Selecciona las carpetas a las que este agente puede acceder:
            </p>

            {[
              { path: '/documentos/*', label: 'Documentos generales', read: true, write: false },
              { path: '/facturas/*', label: 'Facturas', read: true, write: true },
              { path: '/clientes/*', label: 'Datos de clientes', read: false, write: false },
              { path: '/stock/*', label: 'Inventario', read: true, write: false },
            ].map((folder) => (
              <div key={folder.path} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span>{folder.label}</span>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1">
                    <input type="checkbox" defaultChecked={folder.read} />
                    <span className="text-sm">Leer</span>
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" defaultChecked={folder.write} />
                    <span className="text-sm">Escribir</span>
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between mt-6">
            <button onClick={() => setStep(2)} className="text-gray-600">← Atrás</button>
            <button
              onClick={() => {/* Crear agente */}}
              className="px-4 py-2 bg-green-500 text-white rounded-lg"
            >
              Crear Agente 🚀
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 13. WhatsApp Multi-Cuenta con Roles

### 13.1 Configuración de Múltiples WhatsApp

```json5
{
  "channels": {
    "whatsapp": {
      "enabled": true,
      "accounts": {
        "ventas": {
          "phoneNumber": "+5491112345678",
          "role": "sales",
          "purpose": "Atención al público",
          "agentId": "ventas",
          "greeting": "¡Hola! Soy Ana de Mi Tienda. ¿En qué puedo ayudarte?"
        },
        "soporte": {
          "phoneNumber": "+5491187654321",
          "role": "support",
          "purpose": "Soporte técnico",
          "agentId": "soporte",
          "greeting": "¡Hola! Soy el equipo de soporte. ¿Tenés algún problema?"
        },
        "compras": {
          "phoneNumber": "+5491166665555",
          "role": "purchasing",
          "purpose": "Proveedores",
          "agentId": "compras",
          "greeting": "¡Hola! Soy del departamento de compras."
        }
      }
    }
  }
}
```

### 13.2 Escalamiento entre Agentes

```typescript
// src/agents/escalation.ts

interface EscalationRule {
  trigger: string | RegExp;
  fromAgent: string;
  toAgent: string;
  message: string;
}

const escalationRules: EscalationRule[] = [
  {
    trigger: /hablar con (un )?humano|supervisor|gerente/i,
    fromAgent: "ventas",
    toAgent: "admin",
    message: "El cliente solicita hablar con un humano."
  },
  {
    trigger: /problema con la factura|error en el cobro/i,
    fromAgent: "ventas",
    toAgent: "contabilidad",
    message: "El cliente tiene un problema con facturación."
  },
  {
    trigger: /no funciona|roto|avería|técnico/i,
    fromAgent: "ventas",
    toAgent: "soporte",
    message: "El cliente reporta un problema técnico."
  }
];

export function checkEscalation(
  message: string,
  currentAgent: string
): EscalationRule | null {
  for (const rule of escalationRules) {
    if (rule.fromAgent === currentAgent && rule.trigger.test(message)) {
      return rule;
    }
  }
  return null;
}

export async function escalateToAgent(
  rule: EscalationRule,
  context: ConversationContext
): Promise<void> {
  // 1. Notificar al agente destino
  await sendNotification(rule.toAgent, {
    type: "escalation",
    from: rule.fromAgent,
    message: rule.message,
    context: context.summary,
    channel: context.channel,
    customer: context.customer,
  });

  // 2. Informar al cliente
  await sendMessage(context.channel, context.customer.id,
    "Te estoy transfiriendo con un colega que puede ayudarte mejor. Un momento..."
  );

  // 3. Transferir la conversación
  await transferConversation(context.id, rule.toAgent);
}
```

---

## 14. Acceso Web por Empleado

### 14.1 Sistema de Login para Empleados

```php
<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\Tenant;
use Illuminate\Http\Request;

class EmployeeAuthController extends Controller
{
    /**
     * Login de empleado
     * POST /employee/login
     */
    public function login(Request $request)
    {
        $request->validate([
            'tenant_code' => 'required',  // ej: "mi-tienda"
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $tenant = Tenant::where('subdomain', $request->tenant_code)->first();

        if (!$tenant) {
            return response()->json(['error' => 'Empresa no encontrada'], 404);
        }

        $employee = Employee::where('tenant_id', $tenant->id)
            ->where('email', $request->email)
            ->first();

        if (!$employee || !Hash::check($request->password, $employee->password)) {
            return response()->json(['error' => 'Credenciales inválidas'], 401);
        }

        // Generar token con el rol del empleado
        $token = $employee->createToken('employee-token', [
            'role:' . $employee->role,
            'agent:' . $employee->agent_id,
            'tenant:' . $tenant->id,
        ]);

        return response()->json([
            'token' => $token->plainTextToken,
            'employee' => $employee,
            'agent_id' => $employee->agent_id,
            'permissions' => $employee->permissions,
        ]);
    }
}
```

### 14.2 Middleware de Permisos

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class CheckEmployeePermission
{
    public function handle(Request $request, Closure $next, string $permission)
    {
        $user = $request->user();

        if (!$user || !$user->tokenCan($permission)) {
            return response()->json([
                'error' => 'No tienes permiso para esta acción'
            ], 403);
        }

        return $next($request);
    }
}
```

### 14.3 URL de Acceso por Empleado

```
https://mi-tienda.misaas.com/login      # Login de empleados
https://mi-tienda.misaas.com/chat       # Chat (agente según rol)
https://mi-tienda.misaas.com/docs       # Documentos (si tiene permiso)
https://mi-tienda.misaas.com/facturas   # Facturas (si tiene permiso)
```

---

## 15. Esquema de Base de Datos

```sql
-- Tabla de empleados/agentes por tenant
CREATE TABLE employees (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id BIGINT NOT NULL,
    agent_id VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('sales', 'support', 'accountant', 'manager', 'admin') NOT NULL,
    permissions JSON,
    channels JSON,                    -- ["whatsapp", "web", "telegram"]
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    UNIQUE KEY unique_tenant_email (tenant_id, email)
);

-- Tabla de sesiones por canal
CREATE TABLE channel_sessions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id BIGINT NOT NULL,
    channel VARCHAR(50) NOT NULL,
    account_id VARCHAR(50) NOT NULL,
    agent_id VARCHAR(50) NOT NULL,
    customer_id VARCHAR(100),
    status ENUM('active', 'transferred', 'closed') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Tabla de logs de acceso a archivos
CREATE TABLE file_access_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id BIGINT NOT NULL,
    employee_id BIGINT NOT NULL,
    operation ENUM('read', 'write', 'delete') NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    success BOOLEAN NOT NULL,
    reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);
```

---

## 16. Ejemplo Completo: Empleado Contabilidad

### Escenario

María trabaja en contabilidad de "Mi Tienda". Necesita:
- Acceder por Web o Slack
- Crear y modificar facturas
- Ver documentos y stock
- NO acceder a conversaciones de ventas
- NO modificar configuración

### Configuración

```json5
{
  "employee": {
    "id": "emp_abc123",
    "name": "María García",
    "email": "maria@mitienda.com",
    "role": "accountant",
    "agent_id": "contabilidad",
    "channels": ["web", "slack"],
    "permissions": {
      "filesystem": {
        "read": [
          "/data/docs/*",
          "/data/facturas/*",
          "/data/stock/*"
        ],
        "write": [
          "/data/docs/*",
          "/data/facturas/*"
        ],
        "delete": [
          "/data/facturas/borradores/*"
        ],
        "deny": [
          "/data/ventas/*",
          "/data/clientes/*",
          "/data/config/*"
        ]
      },
      "tools": [
        "crear_factura",
        "modificar_factura",
        "anular_factura",
        "ver_stock",
        "exportar_excel",
        "enviar_email"
      ],
      "restrictions": [
        "No puede acceder a conversaciones",
        "No puede modificar configuración",
        "No puede acceder a datos de clientes"
      ]
    }
  }
}
```

### Interacción Ejemplo

```
María (Web): "Muéstrame las facturas de esta semana"

Agente Contabilidad:
  ✓ Permiso verificado: /data/facturas/*

  "Estas son las facturas de la semana:

  | # | Cliente | Monto | Estado |
  |---|---------|-------|--------|
  | 001 | Juan Pérez | $1,500 | Pagada |
  | 002 | Ana López | $2,300 | Pendiente |
  | 003 | Carlos Ruiz | $950 | Pagada |

  Total: $4,750"

María (Web): "Anula la factura 003"

Agente Contabilidad:
  ✓ Permiso verificado: anular_factura
  ✓ Permiso verificado: /data/facturas/* (write)

  "Factura #003 anulada. Motivo requerido para el registro."

María (Web): "El cliente solicitó devolución"

Agente Contabilidad:
  "Factura #003 anulada con motivo: 'Devolución solicitada por cliente'.
   Se ha notificado al área de ventas."
```

---

## 12. Pendientes / Preguntas

- [x] ~~Definir dominio final del SaaS~~
- [x] ~~Sistema de multi-agente con roles~~
- [x] ~~Permisos de archivos por rol~~
- [x] ~~Acceso de empleados por Web/Telegram~~
- [ ] Decidir entre Stripe solo o ambos procesadores
- [ ] ¿Necesita cada tenant su propio certificado SSL?
- [ ] ¿Cómo manejar upgrades/downgrades de plan?
- [ ] ¿Backup automático incluido o como add-on?
- [ ] Implementar middleware de permisos en Agento
- [ ] Crear UI de gestión de empleados en el SaaS
- [ ] Sistema de auditoría de acciones por empleado

---

*Documento creado: 2026-02-14*
*Última actualización: 2026-02-14*
