import { describe, it, expect, beforeEach } from 'vitest';
import { DynamicAPIManager } from './dynamic-api-manager.js';
import type { DynamicAPIConfig } from './types.js';

describe('DynamicAPIManager', () => {
  let manager: DynamicAPIManager;

  const validAPIConfig: DynamicAPIConfig = {
    id: 'test-api',
    name: 'Test API',
    baseUrl: 'https://api.example.com',
    description: 'API for testing',
    auth: {
      type: 'bearer',
      bearerToken: 'test-token-123',
    },
    endpoints: [
      {
        name: 'getUsers',
        path: '/users',
        method: 'GET',
        description: 'Get all users',
      },
      {
        name: 'createUser',
        path: '/users',
        method: 'POST',
        parameters: [
          {
            name: 'name',
            type: 'string',
            required: true,
            description: 'User name',
          },
          {
            name: 'email',
            type: 'string',
            required: true,
            description: 'User email',
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    manager = new DynamicAPIManager();
  });

  describe('validateConfig', () => {
    it('should validate a correct config', () => {
      const result = manager.validateConfig(validAPIConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject config without ID', () => {
      const config = { ...validAPIConfig, id: '' };
      const result = manager.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('API ID is required');
    });

    it('should reject config without name', () => {
      const config = { ...validAPIConfig, name: '' };
      const result = manager.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('API name is required');
    });

    it('should reject config with invalid URL', () => {
      const config = { ...validAPIConfig, baseUrl: 'not-a-url' };
      const result = manager.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Base URL must be a valid URL');
    });

    it('should reject config without endpoints', () => {
      const config = { ...validAPIConfig, endpoints: [] };
      const result = manager.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least one endpoint is required');
    });

    it('should validate bearer auth', () => {
      const config = {
        ...validAPIConfig,
        auth: { type: 'bearer' as const },
      };
      const result = manager.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Bearer token is required for bearer auth');
    });

    it('should validate api_key auth', () => {
      const config = {
        ...validAPIConfig,
        auth: { type: 'api_key' as const },
      };
      const result = manager.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('API key is required for api_key auth');
    });

    it('should validate basic auth', () => {
      const config = {
        ...validAPIConfig,
        auth: { type: 'basic' as const, username: 'user' },
      };
      const result = manager.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Username and password are required for basic auth');
    });

    it('should accept none auth', () => {
      const config = {
        ...validAPIConfig,
        auth: { type: 'none' as const },
      };
      const result = manager.validateConfig(config);
      expect(result.valid).toBe(true);
    });
  });

  describe('registerAPI', () => {
    it('should register a valid API', () => {
      const result = manager.registerAPI(validAPIConfig);
      expect(result).toBe(true);

      const api = manager.getAPI('test-api');
      expect(api).toBeDefined();
      expect(api?.name).toBe('Test API');
    });

    it('should throw on invalid config', () => {
      const invalidConfig = { ...validAPIConfig, id: '' };
      expect(() => manager.registerAPI(invalidConfig)).toThrow('Invalid API config');
    });

    it('should throw on duplicate ID', () => {
      manager.registerAPI(validAPIConfig);
      expect(() => manager.registerAPI(validAPIConfig)).toThrow('already exists');
    });

    it('should set default values', () => {
      manager.registerAPI(validAPIConfig);
      const api = manager.getAPI('test-api');
      
      expect(api?.enabled).toBe(true);
      expect(api?.timeoutMs).toBe(30000);
      expect(api?.tags).toEqual([]);
    });
  });

  describe('getAPI', () => {
    it('should return API by ID', () => {
      manager.registerAPI(validAPIConfig);
      const api = manager.getAPI('test-api');
      
      expect(api).toBeDefined();
      expect(api?.id).toBe('test-api');
    });

    it('should return undefined for non-existent ID', () => {
      const api = manager.getAPI('non-existent');
      expect(api).toBeUndefined();
    });
  });

  describe('getAllAPIs', () => {
    it('should return all APIs', () => {
      manager.registerAPI(validAPIConfig);
      manager.registerAPI({ ...validAPIConfig, id: 'api-2', name: 'API 2' });

      const apis = manager.getAllAPIs();
      expect(apis).toHaveLength(2);
    });

    it('should filter by enabled status', () => {
      manager.registerAPI(validAPIConfig);
      manager.registerAPI({ ...validAPIConfig, id: 'api-2', enabled: false });

      const enabledAPIs = manager.getAllAPIs(true);
      expect(enabledAPIs).toHaveLength(1);
      expect(enabledAPIs[0].id).toBe('test-api');
    });
  });

  describe('findByTags', () => {
    it('should find APIs by tags', () => {
      manager.registerAPI({ ...validAPIConfig, tags: ['crm', 'sales'] });
      manager.registerAPI({ ...validAPIConfig, id: 'api-2', tags: ['inventory'] });

      const crmAPIs = manager.findByTags(['crm']);
      expect(crmAPIs).toHaveLength(1);
      expect(crmAPIs[0].id).toBe('test-api');
    });

    it('should return APIs matching any tag', () => {
      manager.registerAPI({ ...validAPIConfig, tags: ['crm'] });
      manager.registerAPI({ ...validAPIConfig, id: 'api-2', tags: ['inventory'] });

      const apis = manager.findByTags(['crm', 'inventory']);
      expect(apis).toHaveLength(2);
    });
  });

  describe('updateAPI', () => {
    it('should update an existing API', () => {
      manager.registerAPI(validAPIConfig);
      
      const updated = manager.updateAPI('test-api', {
        name: 'Updated API',
        description: 'New description',
      });

      expect(updated).toBe(true);

      const api = manager.getAPI('test-api');
      expect(api?.name).toBe('Updated API');
      expect(api?.description).toBe('New description');
    });

    it('should throw on non-existent API', () => {
      expect(() => manager.updateAPI('non-existent', {})).toThrow('not found');
    });

    it('should validate updated config', () => {
      manager.registerAPI(validAPIConfig);
      
      expect(() => manager.updateAPI('test-api', { baseUrl: 'invalid' })).toThrow('Invalid API config');
    });
  });

  describe('deleteAPI', () => {
    it('should delete an API', () => {
      manager.registerAPI(validAPIConfig);
      
      const deleted = manager.deleteAPI('test-api');
      expect(deleted).toBe(true);

      const api = manager.getAPI('test-api');
      expect(api).toBeUndefined();
    });

    it('should return false for non-existent API', () => {
      const deleted = manager.deleteAPI('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('setEnabled', () => {
    it('should enable/disable an API', () => {
      manager.registerAPI(validAPIConfig);
      
      manager.setEnabled('test-api', false);
      let api = manager.getAPI('test-api');
      expect(api?.enabled).toBe(false);

      manager.setEnabled('test-api', true);
      api = manager.getAPI('test-api');
      expect(api?.enabled).toBe(true);
    });

    it('should return false for non-existent API', () => {
      const result = manager.setEnabled('non-existent', true);
      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all APIs', () => {
      manager.registerAPI(validAPIConfig);
      manager.registerAPI({ ...validAPIConfig, id: 'api-2' });

      manager.clear();

      const apis = manager.getAllAPIs();
      expect(apis).toHaveLength(0);
    });
  });
});
