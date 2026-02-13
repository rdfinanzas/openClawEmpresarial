#!/usr/bin/env node
/**
 * Prueba del panel de administración web
 * 
 * Inicia un servidor de prueba y verifica los endpoints
 */

import http from 'node:http';
import { handleAdminHttpRequest } from './src/web/admin/index.js';

const PORT = 8765;

console.log('\n🌐 Testing Admin Panel Web Server\n');
console.log('=' .repeat(50));

const server = http.createServer(async (req, res) => {
  console.log(`📥 ${req.method} ${req.url}`);
  
  // Set CORS headers para testing
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }
  
  // Try admin handler
  const handled = await handleAdminHttpRequest(req, res);
  
  if (!handled) {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, () => {
  console.log(`\n✅ Server running at http://localhost:${PORT}`);
  console.log('\nTest URLs:');
  console.log(`  - Admin Login:  http://localhost:${PORT}/admin/login`);
  console.log(`  - Admin API:    http://localhost:${PORT}/admin/api/health`);
  console.log(`  - Redirect:     http://localhost:${PORT}/admin`);
  console.log('\nPress Ctrl+C to stop\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
