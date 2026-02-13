#!/usr/bin/env pwsh
# Script de inicio rápido para OpenClaw en Windows

param(
    [switch]$SkipWizard,
    [switch]$SkipChannels,
    [switch]$DevMode,
    [int]$Port = 18789
)

$ErrorActionPreference = "Stop"

function Write-Header($text) {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host $text -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
}

function Write-Success($text) {
    Write-Host "✅ $text" -ForegroundColor Green
}

function Write-Error($text) {
    Write-Host "❌ $text" -ForegroundColor Red
}

function Write-Info($text) {
    Write-Host "ℹ️  $text" -ForegroundColor Yellow
}

# ========================================
# 1. Verificar Node.js
# ========================================
Write-Header "Verificando entorno"

try {
    $nodeVersion = node --version
    Write-Success "Node.js encontrado: $nodeVersion"
} catch {
    Write-Error "Node.js no encontrado. Instala Node 22+ desde https://nodejs.org"
    exit 1
}

# ========================================
# 2. Instalar dependencias si es necesario
# ========================================
if (-not (Test-Path "node_modules")) {
    Write-Header "Instalando dependencias"
    npm install
    Write-Success "Dependencias instaladas"
} else {
    Write-Info "Dependencias ya instaladas"
}

# ========================================
# 3. Verificar/crear config.json
# ========================================
Write-Header "Verificando configuración"

if (-not (Test-Path "config.json") -and -not $SkipWizard) {
    Write-Info "No se encontró config.json"
    Write-Info "Iniciando wizard empresarial..."
    
    $startWizard = Read-Host "¿Deseas configurar OpenClaw ahora? (S/n)"
    if ($startWizard -ne 'n') {
        node scripts/run-node.mjs enterprise setup
    } else {
        Write-Info "Creando config.json básico..."
        @'{
  "gateway": {
    "port": 18789,
    "bind": "loopback"
  },
  "channels": {},
  "agents": {
    "default": "openclaw"
  },
  "logging": {
    "level": "info"
  }
}'@ | Out-File -FilePath "config.json" -Encoding UTF8
        Write-Success "config.json creado"
    }
} else {
    Write-Success "Configuración encontrada"
}

# ========================================
# 4. Configurar variables de entorno
# ========================================
if ($SkipChannels) {
    $env:OPENCLAW_SKIP_CHANNELS = "1"
    $env:CLAWDBOT_SKIP_CHANNELS = "1"
    Write-Info "Canales omitidos (SKIP_CHANNELS=1)"
}

# ========================================
# 5. Iniciar Gateway
# ========================================
Write-Header "Iniciando OpenClaw Gateway"

Write-Info "Puerto: $Port"
Write-Info "Modo: $(if ($DevMode) { 'Desarrollo' } else { 'Producción' })"

$url = "http://localhost:$Port/admin"

Write-Host "`n========================================"
Write-Host "🚀 Iniciando servidor..."
Write-Host "📍 Admin Panel: $url"
Write-Host "========================================`n"

# Abrir navegador después de 3 segundos
Start-Job -ScriptBlock {
    Start-Sleep -Seconds 3
    Start-Process $using:url
} | Out-Null

# Iniciar el gateway
try {
    if ($DevMode) {
        node scripts/run-node.mjs --dev gateway
    } else {
        node scripts/run-node.mjs gateway
    }
} catch {
    Write-Error "Error al iniciar el gateway: $_"
    Write-Info "Verifica que el puerto $Port no esté en uso"
    Write-Info "Puedes cambiar el puerto con: -Port 8080"
}
