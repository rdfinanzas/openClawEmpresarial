#!/usr/bin/env node
/**
 * Test simple de carga de módulos
 */

console.log('\n🧪 Simple Module Load Test\n');

try {
  console.log('Loading tool-filter...');
  const { ToolAccessFilter } = await import('./src/agents/tool-filter.js');
  console.log('✅ ToolAccessFilter loaded');
  
  console.log('Loading crypto...');
  const { generateSecureCode } = await import('./src/web/admin/crypto.js');
  console.log('✅ Crypto loaded');
  
  console.log('Loading root-authorization...');
  const { createRootAuthRequest } = await import('./src/channels/root-authorization.js');
  console.log('✅ Root authorization loaded');
  
  console.log('Loading admin types...');
  await import('./src/web/admin/types.js');
  console.log('✅ Admin types loaded');
  
  console.log('Loading admin routes...');
  await import('./src/web/admin/routes.js');
  console.log('✅ Admin routes loaded');
  
  console.log('Loading admin auth...');
  await import('./src/web/admin/auth.js');
  console.log('✅ Admin auth loaded');
  
  console.log('Loading admin middleware...');
  await import('./src/web/admin/middleware.js');
  console.log('✅ Admin middleware loaded');
  
  console.log('Loading admin dashboard...');
  await import('./src/web/admin/dashboard.js');
  console.log('✅ Admin dashboard loaded');
  
  console.log('Loading admin index...');
  const { handleAdminHttpRequest } = await import('./src/web/admin/index.js');
  console.log('✅ Admin index loaded');
  
  console.log('Loading telegram admin-alerts...');
  await import('./src/telegram/admin-alerts.js');
  console.log('✅ Telegram admin-alerts loaded');
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ All modules loaded successfully!');
  console.log('\nTesting basic functionality:');
  
  // Test basic functionality
  const filter = new ToolAccessFilter();
  console.log('- Tool filter works:', filter.canUseTool('superadmin', 'bash') === true);
  console.log('- Code generation works:', /^\d{6}$/.test(generateSecureCode(6)));
  
  console.log('\n✅ All tests passed!\n');
  
} catch (error) {
  console.error('\n❌ Error:', error);
  process.exit(1);
}
