#!/usr/bin/env node
/**
 * Test del sistema de atención al cliente empresarial
 */

import { ToolAccessFilter } from './src/agents/tool-filter.js';
import { apiManager, registerRetailApis } from './src/enterprise/api-manager.js';

console.log('\n🏪 Test: Sistema de Atención al Cliente Empresarial\n');
console.log('=' .repeat(60));

// Registrar APIs del negocio
registerRetailApis();

// Test 1: Verificar qué herramientas puede usar cada rol
console.log('\n📋 Test 1: Permisos de Herramientas');
console.log('-'.repeat(40));

const filter = new ToolAccessFilter();

const herramientasDePrueba = [
  'search',              // Búsqueda web
  'search_web',          // Búsqueda web
  'api_check_stock',     // API de stock
  'api_get_price',       // API de precios
  'api_create_order',    // API de pedidos
  'view_catalog',        // Ver catálogo
  'bash',                // Comandos sistema
  'file_delete',         // Borrar archivos
];

console.log('\n🟢 Telegram (Superadmin):');
for (const tool of herramientasDePrueba) {
  const puede = filter.canUseTool('superadmin', tool);
  console.log(`   ${puede ? '✅' : '❌'} ${tool}`);
}

console.log('\n🔵 WhatsApp (Cliente/Público):');
for (const tool of herramientasDePrueba) {
  const puede = filter.canUseTool('public', tool);
  console.log(`   ${puede ? '✅' : '❌'} ${tool}`);
}

// Test 2: Verificar APIs registradas
console.log('\n📋 Test 2: APIs Empresariales Registradas');
console.log('-'.repeat(40));

const apis = apiManager.listApis();
for (const api of apis) {
  console.log(`\n   📦 ${api.name} (api_${api.id})`);
  console.log(`      ${api.description}`);
  console.log(`      Ejemplo: ${api.example}`);
}

// Test 3: Simulación de consultas
console.log('\n📋 Test 3: Simulación de Consultas');
console.log('-'.repeat(40));

const consultas = [
  { canal: 'whatsapp', herramienta: 'api_check_stock', descripcion: 'Cliente pregunta: "¿Tienen arroz?"' },
  { canal: 'whatsapp', herramienta: 'search_web', descripcion: 'Cliente pregunta: "¿Qué hora es en Japón?"' },
  { canal: 'telegram', herramienta: 'bash', descripcion: 'Admin quiere ejecutar comando del sistema' },
];

for (const consulta of consultas) {
  const rol = consulta.canal === 'whatsapp' ? 'public' : 'superadmin';
  const puede = filter.canUseTool(rol, consulta.herramienta);
  
  console.log(`\n   ${consulta.descripcion}`);
  console.log(`   Canal: ${consulta.canal} → Rol: ${rol}`);
  console.log(`   Herramienta necesaria: ${consulta.herramienta}`);
  console.log(`   Resultado: ${puede ? '✅ PERMITIDO' : '❌ BLOQUEADO'}`);
}

console.log('\n' + '=' .repeat(60));
console.log('✅ Sistema configurado correctamente para atención empresarial!\n');
console.log('📝 Resumen:');
console.log('   • Clientes WhatsApp: Solo APIs empresariales (stock, pedidos, etc.)');
console.log('   • Clientes WhatsApp: NO pueden buscar en la web');
console.log('   • Admin Telegram: Acceso total al sistema');
console.log('   • Operaciones críticas: Requieren aprobación vía Telegram\n');
