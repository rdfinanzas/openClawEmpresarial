import { describe, it, expect, beforeEach } from 'vitest';
import { ToolGenerator } from './tool-generator.js';
import type { DynamicAPIConfig } from './types.js';

describe('ToolGenerator', () => {
  let generator: ToolGenerator;

  const sampleAPI: DynamicAPIConfig = {
    id: 'crm-api',
    name: 'CRM API',
    baseUrl: 'https://api.crm.example.com',
    description: 'Customer Relationship Management API',
    auth: {
      type: 'bearer',
      bearerToken: 'test-token',
    },
    endpoints: [
      {
        name: 'getCustomers',
        path: '/customers',
        method: 'GET',
        description: 'Retrieve all customers',
      },
      {
        name: 'createCustomer',
        path: '/customers',
        method: 'POST',
        description: 'Create a new customer',
        parameters: [
          {
            name: 'name',
            type: 'string',
            required: true,
            description: 'Customer name',
          },
          {
            name: 'email',
            type: 'string',
            required: true,
            description: 'Customer email',
          },
          {
            name: 'phone',
            type: 'string',
            required: false,
            description: 'Customer phone number',
          },
        ],
      },
    ],
    enabled: true,
  };

  beforeEach(() => {
    generator = new ToolGenerator();
  });

  describe('generateToolFromEndpoint', () => {
    it('should generate a tool from an endpoint', () => {
      const tool = generator.generateToolFromEndpoint(sampleAPI, sampleAPI.endpoints[0]);

      expect(tool.name).toBe('api_crm_api_getcustomers');
      expect(tool.description).toContain('Retrieve all customers');
      expect(tool.metadata.apiId).toBe('crm-api');
      expect(tool.metadata.method).toBe('GET');
    });

    it('should generate parameters schema correctly', () => {
      const tool = generator.generateToolFromEndpoint(sampleAPI, sampleAPI.endpoints[1]);

      expect(tool.parameters.type).toBe('object');
      expect(tool.parameters.properties).toHaveProperty('name');
      expect(tool.parameters.properties).toHaveProperty('email');
      expect(tool.parameters.properties).toHaveProperty('phone');
      expect(tool.parameters.required).toEqual(['name', 'email']);
    });

    it('should handle endpoints without parameters', () => {
      const tool = generator.generateToolFromEndpoint(sampleAPI, sampleAPI.endpoints[0]);

      expect(tool.parameters.properties).toEqual({});
      expect(tool.parameters.required).toEqual([]);
    });

    it('should include metadata for execution', () => {
      const tool = generator.generateToolFromEndpoint(sampleAPI, sampleAPI.endpoints[1]);

      expect(tool.metadata).toEqual({
        apiId: 'crm-api',
        endpointName: 'createCustomer',
        method: 'POST',
        path: '/customers',
      });
    });
  });

  describe('generateToolsFromAPI', () => {
    it('should generate tools for all endpoints', () => {
      const tools = generator.generateToolsFromAPI(sampleAPI);

      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('api_crm_api_getcustomers');
      expect(tools[1].name).toBe('api_crm_api_createcustomer');
    });

    it('should skip disabled APIs', () => {
      const disabledAPI = { ...sampleAPI, enabled: false };
      const tools = generator.generateToolsFromAPI(disabledAPI);

      expect(tools).toHaveLength(0);
    });
  });

  describe('generateToolsFromAPIs', () => {
    it('should generate tools from multiple APIs', () => {
      const api2: DynamicAPIConfig = {
        id: 'inventory-api',
        name: 'Inventory API',
        baseUrl: 'https://api.inventory.example.com',
        auth: { type: 'none' },
        endpoints: [
          {
            name: 'getStock',
            path: '/stock',
            method: 'GET',
          },
        ],
        enabled: true,
      };

      const tools = generator.generateToolsFromAPIs([sampleAPI, api2]);

      expect(tools).toHaveLength(3);
      expect(tools.map(t => t.metadata.apiId)).toContain('crm-api');
      expect(tools.map(t => t.metadata.apiId)).toContain('inventory-api');
    });
  });

  describe('validateToolNames', () => {
    it('should detect duplicate tool names', () => {
      const tools = [
        generator.generateToolFromEndpoint(sampleAPI, sampleAPI.endpoints[0]),
        generator.generateToolFromEndpoint(sampleAPI, sampleAPI.endpoints[0]), // Duplicado
      ];

      const duplicates = generator.validateToolNames(tools);

      expect(duplicates).toHaveLength(1);
      expect(duplicates[0]).toBe('api_crm_api_getcustomers');
    });

    it('should return empty array when no duplicates', () => {
      const tools = generator.generateToolsFromAPI(sampleAPI);
      const duplicates = generator.validateToolNames(tools);

      expect(duplicates).toHaveLength(0);
    });
  });

  describe('tool naming', () => {
    it('should generate valid snake_case names', () => {
      const api: DynamicAPIConfig = {
        id: 'My-Cool API!',
        name: 'Test',
        baseUrl: 'https://test.com',
        auth: { type: 'none' },
        endpoints: [
          {
            name: 'Get User Data',
            path: '/users',
            method: 'GET',
          },
        ],
        enabled: true,
      };

      const tool = generator.generateToolFromEndpoint(api, api.endpoints[0]);

      expect(tool.name).toBe('api_my_cool_api_get_user_data');
      expect(tool.name).toMatch(/^[a-z_]+$/);
    });
  });

  describe('parameter type conversion', () => {
    it('should convert all parameter types correctly', () => {
      const api: DynamicAPIConfig = {
        id: 'test',
        name: 'Test',
        baseUrl: 'https://test.com',
        auth: { type: 'none' },
        endpoints: [
          {
            name: 'testEndpoint',
            path: '/test',
            method: 'POST',
            parameters: [
              { name: 'str', type: 'string', required: true },
              { name: 'num', type: 'number', required: true },
              { name: 'bool', type: 'boolean', required: true },
              { name: 'obj', type: 'object', required: true },
              { name: 'arr', type: 'array', required: true },
            ],
          },
        ],
        enabled: true,
      };

      const tool = generator.generateToolFromEndpoint(api, api.endpoints[0]);

      expect(tool.parameters.properties.str.type).toBe('string');
      expect(tool.parameters.properties.num.type).toBe('number');
      expect(tool.parameters.properties.bool.type).toBe('boolean');
      expect(tool.parameters.properties.obj.type).toBe('object');
      expect(tool.parameters.properties.arr.type).toBe('array');
    });
  });
});
