# Guía de Despliegue - OpenClaw Transform

> Versión 1.0 | Última actualización: 2026-02-12

## 📋 Tabla de Contenidos

1. [Pre-requisitos](#pre-requisitos)
2. [Checklist Pre-Deployment](#checklist-pre-deployment)
3. [Despliegue Paso a Paso](#despliegue-paso-a-paso)
4. [Configuración Post-Deployment](#configuración-post-deployment)
5. [Monitoreo](#monitoreo)
6. [Rollback](#rollback)
7. [Solución de Problemas](#solución-de-problemas)

---

## Pre-requisitos

### Hardware Recomendado

| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 2 GB | 4 GB |
| Disco | 10 GB SSD | 20 GB SSD |
| Red | 100 Mbps | 1 Gbps |

### Software Requerido

- Node.js 22+
- npm 10+ o pnpm 8+
- Git
- (Opcional) Docker 24+
- (Opcional) Redis 7+ (para producción)

### Cuentas y Tokens

- [ ] Cuenta de Telegram
- [ ] Bot token de Telegram (@BotFather)
- [ ] Telegram User ID del superadmin
- [ ] (Opcional) Tokens para otros canales (WhatsApp, Discord, etc.)
- [ ] (Opcional) Claves API para servicios empresariales

---

## Checklist Pre-Deployment

### Seguridad ✅

- [ ] Ejecutar auditoría de seguridad: `openclaw security audit --deep`
- [ ] Verificar que no hay secretos en el código
- [ ] Configurar HTTPS con certificados válidos
- [ ] Configurar firewall (puertos necesarios)
- [ ] Verificar permisos de archivos sensibles

### Configuración ✅

- [ ] Configurar `superadmin.telegramUserId`
- [ ] Configurar canales habilitados
- [ ] Verificar `tools.publicAllowed` y `tools.publicForbidden`
- [ ] Configurar rate limiting
- [ ] Configurar timeouts de sesión

### Testing ✅

- [ ] Ejecutar tests unitarios: `pnpm test`
- [ ] Ejecutar tests de integración: `pnpm test:integration`
- [ ] Ejecutar tests de seguridad: `pnpm test:security`
- [ ] Verificar flujo de login en panel admin
- [ ] Verificar autorización root vía Telegram

### Backup ✅

- [ ] Crear backup de configuración actual
- [ ] Documentar procedimiento de rollback
- [ ] Verificar restauración de backup

---

## Despliegue Paso a Paso

### 1. Preparación del Servidor

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar instalación
node --version  # v22.x.x
npm --version   # 10.x.x
```

### 2. Instalación de OpenClaw

```bash
# Instalar globalmente
npm install -g openclaw@latest

# Verificar instalación
openclaw --version
```

### 3. Configuración Inicial

```bash
# Crear directorio de configuración
mkdir -p ~/.openclaw

# Configurar superadmin
openclaw config set superadmin.telegramUserId=123456789
openclaw config set superadmin.enabled=true

# Configurar Telegram
openclaw config set channels.telegram.enabled=true
openclaw config set channels.telegram.accounts.0.default=true

# Configurar otros canales (opcional)
openclaw config set channels.whatsapp.enabled=true
openclaw config set channels.discord.enabled=true
openclaw config set channels.slack.enabled=true
```

### 4. Configuración de Variables de Entorno

```bash
# Crear archivo .env en ~/.openclaw/
cat > ~/.openclaw/.env << 'EOF'
# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Admin Panel
ADMIN_PANEL_ENABLED=true
ADMIN_SESSION_TIMEOUT=86400000

# Gateway
GATEWAY_PORT=18789
GATEWAY_BIND=0.0.0.0

# Seguridad
NODE_ENV=production
EOF

# Proteger archivo
chmod 600 ~/.openclaw/.env
```

### 5. Configuración de HTTPS (Producción)

```bash
# Instalar Certbot
sudo apt install certbot -y

# Obtener certificado
sudo certbot certonly --standalone -d your-domain.com

# Configurar en OpenClaw
openclaw config set gateway.tls.enabled=true
openclaw config set gateway.tls.certPath=/etc/letsencrypt/live/your-domain.com/fullchain.pem
openclaw config set gateway.tls.keyPath=/etc/letsencrypt/live/your-domain.com/privkey.pem
```

### 6. Configuración de Systemd (Servicio)

```bash
# Crear archivo de servicio
sudo tee /etc/systemd/system/openclaw.service > /dev/null << 'EOF'
[Unit]
Description=OpenClaw Gateway
After=network.target

[Service]
Type=simple
User=openclaw
Group=openclaw
WorkingDirectory=/home/openclaw
Environment=NODE_ENV=production
EnvironmentFile=/home/openclaw/.openclaw/.env
ExecStart=/usr/bin/openclaw gateway run
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Crear usuario
sudo useradd -r -s /bin/false openclaw

# Recargar systemd
sudo systemctl daemon-reload
sudo systemctl enable openclaw
```

### 7. Iniciar Servicio

```bash
# Iniciar
sudo systemctl start openclaw

# Verificar estado
sudo systemctl status openclaw

# Ver logs
sudo journalctl -u openclaw -f
```

### 8. Configuración Inicial del Admin

```bash
# Crear cuenta de admin
openclaw admin create --username admin

# Esto generará una contraseña temporal
# Guardarla en un lugar seguro
```

---

## Configuración Post-Deployment

### 1. Verificar Canales

```bash
# Verificar estado de canales
openclaw channels status --probe
```

### 2. Configurar APIs Empresariales (Opcional)

```bash
# Agregar API de stock
openclaw api add \
  --name "stock_api" \
  --url "https://api.tienda.com" \
  --auth-type bearer \
  --token "${STOCK_API_TOKEN}"

# Verificar APIs configuradas
openclaw api list
```

### 3. Configurar Monitoreo

```bash
# Habilitar monitoreo
openclaw config set monitoring.enabled=true
openclaw config set monitoring.interval=60000

# Configurar alertas Telegram
openclaw config set alerts.telegram.enabled=true
```

---

## Monitoreo

### Métricas a Monitorear

| Métrica | Umbral de Alerta | Comando |
|---------|------------------|---------|
| Uptime | < 99% | `systemctl status openclaw` |
| Memoria | > 80% | `htop` o `free -m` |
| CPU | > 80% | `htop` |
| Mensajes/min | Caída repentina | Panel Admin |
| Errores | > 10/min | `journalctl -u openclaw` |

### Comandos Útiles

```bash
# Ver logs en tiempo real
sudo journalctl -u openclaw -f

# Ver estado del gateway
openclaw gateway status

# Ver métricas
curl http://localhost:18789/admin/api/dashboard/health

# Ver sesiones activas
openclaw sessions list
```

### Alertas Automáticas

Configurar en Panel Admin > Monitoring:

- [ ] Canal caído por más de 5 minutos
- [ ] Uso de memoria > 90%
- [ ] Errores > 50 en 10 minutos
- [ ] Latencia de respuesta > 10s

---

## Rollback

### Plan de Rollback

Si ocurre un problema crítico:

```bash
# 1. Detener servicio
sudo systemctl stop openclaw

# 2. Restaurar configuración anterior
cp ~/.openclaw/openclaw.json.backup ~/.openclaw/openclaw.json

# 3. Downgrade (si es necesario)
npm install -g openclaw@previous-version

# 4. Reiniciar
sudo systemctl start openclaw
```

### Backup Automático

```bash
# Agregar a crontab
crontab -e

# Backup diario a las 3 AM
0 3 * * * tar -czf ~/backups/openclaw-$(date +\%Y\%m\%d).tar.gz ~/.openclaw/
```

---

## Solución de Problemas

### Problema: Gateway no inicia

```bash
# Verificar errores
sudo journalctl -u openclaw -n 50

# Verificar puerto en uso
sudo lsof -i :18789

# Verificar permisos
ls -la ~/.openclaw/
```

### Problema: Telegram no responde

```bash
# Verificar token
openclaw config get channels.telegram.accounts.0.botToken

# Verificar webhook (si aplica)
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo

# Probar envío manual
curl -X POST "https://api.telegram.org/bot<TOKEN>/sendMessage" \
  -d "chat_id=<USER_ID>&text=Test"
```

### Problema: Panel admin inaccesible

```bash
# Verificar firewall
sudo ufw status

# Verificar que el servicio escucha
sudo netstat -tlnp | grep 18789

# Verificar logs
sudo journalctl -u openclaw | grep "admin"
```

### Problema: Alto uso de memoria

```bash
# Verificar leaks
openclaw doctor --memory

# Reiniciar servicio
sudo systemctl restart openclaw

# Considerar aumentar RAM o configurar swap
```

---

## Contactos de Soporte

| Rol | Contacto | Escalamiento |
|-----|----------|--------------|
| Soporte Técnico | soporte@openclaw.ai | Nivel 1 |
| Seguridad | security@openclaw.ai | Nivel 2 |
| Emergencias | +1-555-OPENCLAW | Nivel 3 |

---

## Referencias

- [Documentación de Usuario](./USER_GUIDE.md)
- [Guía de Seguridad](./SECURITY_AUDIT.md)
- [Configuración de APIs](./DYNAMIC_APIS.md)

---

**¡Despliegue exitoso!** 🚀
