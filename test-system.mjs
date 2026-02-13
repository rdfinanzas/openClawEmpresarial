#!/usr/bin/env node
/**
 * Script de prueba del sistema OpenClaw con Superadmin
 * 
 * Prueba:
 * - Tool filtering
 * - Admin auth
 * - Telegram verification
 * - Root authorization
 */

import { ToolAccessFilter } from './src/agents/tool-filter.js';
import { generateSecureCode, hashPassword, verifyPassword } from './src/web/admin/crypto.js';
import { createRootAuthRequest, approveRootAuthRequest, canPerformOperation } from './src/channels/root-authorization.js';

console.log('\n🧪 Testing OpenClaw Superadmin System\n');
console.log('=' .repeat(50));

// Test 1: Tool Access Filter
console.log('\n📋 Test 1: Tool Access Filter');
console.log('-'.repeat(30));
const filter = new ToolAccessFilter();
const testTools = [
  { name: 'search' },
  { name: 'bash' },
  { name: 'file_delete' },
  { name: 'calendar_view' },
  { name: 'system_restart' }
];

console.log('Superadmin can use bash:', filter.canUseTool('superadmin', 'bash'));
console.log('Public can use bash:', filter.canUseTool('public', 'bash'));
console.log('Public can use search:', filter.canUseTool('public', 'search'));

const publicTools = filter.filterToolsForRole('public', testTools);
console.log('Public filtered tools:', publicTools.map(t => t.name));

// Test 2: Crypto functions
console.log('\n📋 Test 2: Crypto Functions');
console.log('-'.repeat(30));
const code = generateSecureCode(6);
console.log('Generated 6-digit code:', code);
console.log('Code is numeric:', /^\d{6}$/.test(code));

const code8 = generateSecureCode(8);
console.log('Generated 8-digit code:', code8);

// Test 3: Password hashing (si bcrypt está disponible)
console.log('\n📋 Test 3: Password Hashing');
console.log('-'.repeat(30));
try {
  const hash = await hashPassword('testpassword123');
  console.log('Password hash created:', hash.substring(0, 20) + '...');
  
  const valid = await verifyPassword('testpassword123', hash);
  console.log('Password verification (correct):', valid);
  
  const invalid = await verifyPassword('wrongpassword', hash);
  console.log('Password verification (wrong):', invalid);
} catch (e) {
  console.log('⚠️  bcrypt not available (expected in dev without native deps)');
}

// Test 4: Root Authorization
console.log('\n📋 Test 4: Root Authorization');
console.log('-'.repeat(30));

// Mock config
const mockConfig = {
  superadmin: {
    rootAuth: {
      enabled: true,
      criticalOperations: ['file_delete', 'config_write'],
      requestExpiryMinutes: 10
    },
    telegramUserId: 123456789
  }
};

const request = createRootAuthRequest(
  'file_delete',
  'Delete sensitive file',
  'user123',
  'telegram',
  mockConfig
);

console.log('Root auth request created:');
console.log('  - ID:', request.id);
console.log('  - Operation:', request.operation);
console.log('  - Status:', request.status);
console.log('  - Expires:', new Date(request.expiresAt).toLocaleString());

// Test approval
const approved = approveRootAuthRequest(request.id, mockConfig);
console.log('Request approved:', approved ? 'Yes' : 'No');

// Test can perform (should be true for non-critical)
const canRun = canPerformOperation('search', 'user123', mockConfig);
console.log('Can perform "search":', canRun);

console.log('\n' + '='.repeat(50));
console.log('✅ All tests completed!\n');
