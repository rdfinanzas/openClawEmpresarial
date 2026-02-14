#!/usr/bin/env node
/**
 * Script simple para iniciar el sistema Agento con Superadmin
 * 
 * Uso: node start-system.mjs
 */

import http from 'node:http';
import { readFileSync } from 'node:fs';
import { handleAdminHttpRequest } from './src/web/admin/index.js';

const PORT = 8765;

console.log('\n🚀 Iniciando Agento Admin System\n');
console.log('=' .repeat(50));

// Configuración simple en memoria
const config = {
  superadmin: {
    enabled: true,
    panel: { enabled: true, sessionTimeoutMinutes: 60 },
    rootAuth: { enabled: true }
  }
};

const server = http.createServer(async (req, res) => {
  // CORS para desarrollo
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }
  
  // Intentar manejar con el admin panel
  const handled = await handleAdminHttpRequest(req, res);
  
  if (!handled) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, () => {
  console.log(`✅ Sistema iniciado en http://localhost:${PORT}`);
  console.log('\n📍 URLs disponibles:');
  console.log(`   • Login:     http://localhost:${PORT}/admin/login`);
  console.log(`   • Health:    http://localhost:${PORT}/admin/api/health`);
  console.log(`   • Dashboard: http://localhost:${PORT}/admin/dashboard`);
  console.log('\n⚠️  Para detener: Ctrl+C\n');
});

process.on('SIGINT', () => {
  console.log('\n👋 Deteniendo sistema...');
  server.close(() => process.exit(0));
});
