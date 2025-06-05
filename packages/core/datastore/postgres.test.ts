import { ApiConfig, ExtractConfig, HttpMethod, RunResult, TransformConfig, Workflow, AuthType, FileType, DecompressionMethod } from '@superglue/shared';
import { beforeEach, describe, expect, it, vi, afterEach, beforeAll, afterAll } from 'vitest';
import { Pool, PoolClient } from 'pg';
import { PostgresStore } from './postgres.js';

// Mock pg module
vi.mock('pg', () => ({
  Pool: vi.fn(),
}));

// Mock datastore config
vi.mock('./datastore.js', () => ({
  getPostgresConfig: vi.fn(() => ({
    host: 'localhost',
    port: 5432,
    database: 'test',
    user: 'test',
    password: 'test',
  })),
}));

describe('PostgresStore', () => {
  let store: PostgresStore;
  let mockPool: any;
  let mockClient: any;
  const testOrgId = 'test-org';

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock client
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };

    // Create mock pool
    mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
    };

    // Mock Pool constructor
    (Pool as any).mockImplementation(() => mockPool);

    // Create store instance
    store = new PostgresStore({
      host: 'localhost',
      port: 5432,
      database: 'test',
      user: 'test',
      password: 'test',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });
  describe('Constructor and Schema Initialization', () => {
    it('should initialize database schema on construction', async () => {
      expect(Pool).toHaveBeenCalledWith({
        host: 'localhost',
        port: 5432,
        database: 'test',
        user: 'test',
        password: 'test',
      });
      
      // Wait for the async initialization to complete
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockPool.connect).toHaveBeenCalled();
    });

    it('should create all required tables', async () => {
      // Wait for the async initialization to complete
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Check that all table creation queries were called
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS api_configs')
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS extract_configs')
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS transform_configs')
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS workflows')
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS runs')
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS tenants')
      );
    });

    it('should release client after schema initialization', async () => {
      // Wait for the async initialization to complete
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('API Config Methods', () => {
    const testConfig: ApiConfig = {
      id: 'test-api-id',
      createdAt: new Date('2023-01-01T00:00:00Z'),
      updatedAt: new Date('2023-01-02T00:00:00Z'),
      urlHost: 'https://test.com',
      urlPath: '/api/test',
      method: HttpMethod.GET,
      headers: { 'Content-Type': 'application/json' },
      queryParams: { limit: 10 },
      instruction: 'Test API',
      authentication: AuthType.HEADER,
      body: '{"test": true}',
      documentationUrl: 'https://docs.test.com',
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should get API config by id', async () => {
      const mockRow = {
        id: testConfig.id,
        org_id: testOrgId,
        config: testConfig,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
      };
      mockClient.query.mockResolvedValue({ rows: [mockRow] });

      const result = await store.getApiConfig(testConfig.id, testOrgId);

      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT * FROM api_configs WHERE id = $1 AND ($2::TEXT IS NULL OR org_id = $2::TEXT)',
        [testConfig.id, testOrgId]
      );
      expect(result).toBeDefined();
      expect(result?.id).toBe(testConfig.id);
    });

    it('should handle URL decoding in getApiConfig', async () => {
      const encodedId = 'test%3Aid';
      const decodedId = 'test:id';
      const mockRow = {
        id: decodedId,
        org_id: testOrgId,
        config: testConfig,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
      };
      mockClient.query.mockResolvedValue({ rows: [mockRow] });

      await store.getApiConfig(encodedId, testOrgId);

      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT * FROM api_configs WHERE id = $1 AND ($2::TEXT IS NULL OR org_id = $2::TEXT)',
        [decodedId, testOrgId]
      );
    });

    it('should return null when API config not found', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      const result = await store.getApiConfig('non-existent', testOrgId);

      expect(result).toBeNull();
    });

    it('should list API configs with pagination', async () => {
      const mockRows = [{
        id: testConfig.id,
        org_id: testOrgId,
        config: testConfig,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
      }];
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }) // count query
        .mockResolvedValueOnce({ rows: mockRows }); // list query

      const result = await store.listApiConfigs(10, 0, testOrgId);

      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) FROM api_configs WHERE $1::TEXT IS NULL OR org_id = $1::TEXT',
        [testOrgId]
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT * FROM api_configs WHERE $1::TEXT IS NULL OR org_id = $1::TEXT ORDER BY id LIMIT $2 OFFSET $3',
        [testOrgId, 10, 0]
      );
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should upsert API config', async () => {
      mockClient.query.mockResolvedValue({ rowCount: 1 });

      const result = await store.upsertApiConfig(testConfig.id, testConfig, testOrgId);

      expect(mockClient.query).toHaveBeenCalledWith(
        'INSERT INTO api_configs (id, org_id, config, created_at, updated_at) VALUES ($1, $2::TEXT, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET org_id = $2::TEXT, config = $3, updated_at = $5',
        [
          testConfig.id,
          testOrgId,
          JSON.stringify(testConfig),
          testConfig.createdAt?.toISOString(),
          testConfig.updatedAt?.toISOString(),
        ]
      );
      expect(result).toEqual(testConfig);
    });

    it('should delete API config', async () => {
      mockClient.query.mockResolvedValue({ rowCount: 1 });

      const result = await store.deleteApiConfig(testConfig.id, testOrgId);

      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM api_configs WHERE id = $1 AND ($2::TEXT IS NULL OR org_id = $2::TEXT) RETURNING id',
        [testConfig.id, testOrgId]
      );
      expect(result).toBe(true);
    });

    it('should return false when deleting non-existent API config', async () => {
      mockClient.query.mockResolvedValue({ rowCount: 0 });

      const result = await store.deleteApiConfig('non-existent', testOrgId);

      expect(result).toBe(false);
    });
  });

  describe('Extract Config Methods', () => {
    const testExtractConfig: ExtractConfig = {
      id: 'test-extract-id',
      createdAt: new Date('2023-01-01T00:00:00Z'),
      updatedAt: new Date('2023-01-02T00:00:00Z'),
      instruction: 'Test extraction',
      urlHost: 'https://test.com',
      urlPath: '/data',
      fileType: FileType.CSV,
      decompressionMethod: DecompressionMethod.GZIP,
      authentication: AuthType.OAUTH2,
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should get extract config by id', async () => {
      const mockRow = {
        id: testExtractConfig.id,
        org_id: testOrgId,
        config: testExtractConfig,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
      };
      mockClient.query.mockResolvedValue({ rows: [mockRow] });

      const result = await store.getExtractConfig(testExtractConfig.id, testOrgId);

      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT * FROM extract_configs WHERE id = $1 AND ($2::TEXT IS NULL OR org_id = $2::TEXT)',
        [testExtractConfig.id, testOrgId]
      );
      expect(result).toBeDefined();
      expect(result?.id).toBe(testExtractConfig.id);
    });

    it('should list extract configs', async () => {
      const mockRows = [{
        id: testExtractConfig.id,
        org_id: testOrgId,
        config: testExtractConfig,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
      }];
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: mockRows });

      const result = await store.listExtractConfigs(10, 0, testOrgId);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should upsert extract config', async () => {
      mockClient.query.mockResolvedValue({ rowCount: 1 });

      const result = await store.upsertExtractConfig(testExtractConfig.id, testExtractConfig, testOrgId);

      expect(mockClient.query).toHaveBeenCalledWith(
        'INSERT INTO extract_configs (id, org_id, config, created_at, updated_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET org_id = $2, config = $3, updated_at = $5',
        [
          testExtractConfig.id,
          testOrgId,
          JSON.stringify(testExtractConfig),
          testExtractConfig.createdAt?.toISOString(),
          testExtractConfig.updatedAt?.toISOString(),
        ]
      );
      expect(result).toEqual(testExtractConfig);
    });

    it('should delete extract config', async () => {
      mockClient.query.mockResolvedValue({ rowCount: 1 });

      const result = await store.deleteExtractConfig(testExtractConfig.id, testOrgId);

      expect(result).toBe(true);
    });
  });

  describe('Transform Config Methods', () => {
    const testTransformConfig: TransformConfig = {
      id: 'test-transform-id',
      createdAt: new Date('2023-01-01T00:00:00Z'),
      updatedAt: new Date('2023-01-02T00:00:00Z'),
      instruction: 'Test transformation',
      responseSchema: { type: 'object' },
      responseMapping: 'data.result',
      confidence: 0.95,
      confidence_reasoning: 'High quality data source',
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should get transform config by id', async () => {
      const mockRow = {
        id: testTransformConfig.id,
        org_id: testOrgId,
        config: testTransformConfig,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
      };
      mockClient.query.mockResolvedValue({ rows: [mockRow] });

      const result = await store.getTransformConfig(testTransformConfig.id, testOrgId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(testTransformConfig.id);
    });

    it('should list transform configs', async () => {
      const mockRows = [{
        id: testTransformConfig.id,
        org_id: testOrgId,
        config: testTransformConfig,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
      }];
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: mockRows });

      const result = await store.listTransformConfigs(10, 0, testOrgId);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should upsert transform config', async () => {
      mockClient.query.mockResolvedValue({ rowCount: 1 });

      const result = await store.upsertTransformConfig(testTransformConfig.id, testTransformConfig, testOrgId);

      expect(result).toEqual(testTransformConfig);
    });

    it('should delete transform config', async () => {
      mockClient.query.mockResolvedValue({ rowCount: 1 });

      const result = await store.deleteTransformConfig(testTransformConfig.id, testOrgId);

      expect(result).toBe(true);
    });
  });
  describe('Workflow Methods', () => {
    const testApiConfig: ApiConfig = {
      id: 'api-config-1',
      createdAt: new Date('2023-01-01T00:00:00Z'),
      updatedAt: new Date('2023-01-01T00:00:00Z'),
      urlHost: 'https://test.com',
      method: HttpMethod.GET,
      instruction: 'Test API',
    };

    const testWorkflow: Workflow = {
      id: 'test-workflow-id',
      createdAt: new Date('2023-01-01T00:00:00Z'),
      updatedAt: new Date('2023-01-02T00:00:00Z'),
      steps: [
        {
          id: 'step-1',
          apiConfig: testApiConfig,
          executionMode: 'DIRECT' as const,
          inputMapping: 'input.data',
          responseMapping: 'response.result',
        },
      ],
      finalTransform: 'data.output',
      responseSchema: { type: 'object' },
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should get workflow by id', async () => {
      const mockRow = {
        id: testWorkflow.id,
        org_id: testOrgId,
        config: testWorkflow,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
      };
      mockClient.query.mockResolvedValue({ rows: [mockRow] });

      const result = await store.getWorkflow(testWorkflow.id, testOrgId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(testWorkflow.id);
    });

    it('should list workflows', async () => {
      const mockRows = [{
        id: testWorkflow.id,
        org_id: testOrgId,
        config: testWorkflow,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
      }];
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: mockRows });

      const result = await store.listWorkflows(10, 0, testOrgId);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should upsert workflow', async () => {
      mockClient.query.mockResolvedValue({ rowCount: 1 });

      const result = await store.upsertWorkflow(testWorkflow.id, testWorkflow, testOrgId);

      expect(result).toEqual(testWorkflow);
    });

    it('should delete workflow', async () => {
      mockClient.query.mockResolvedValue({ rowCount: 1 });

      const result = await store.deleteWorkflow(testWorkflow.id, testOrgId);

      expect(result).toBe(true);
    });
  });
  describe('Run Result Methods', () => {
    const testRunResult: RunResult = {
      id: 'test-run-id',
      success: true,
      data: { result: 'test data' },
      startedAt: new Date('2023-01-01T10:00:00Z'),
      completedAt: new Date('2023-01-01T10:05:00Z'),
      config: {
        id: 'config-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        urlHost: 'https://test.com',
        method: HttpMethod.GET,
        instruction: 'Test API config',
      } as ApiConfig,
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should get run by id', async () => {
      const mockRow = {
        id: testRunResult.id,
        org_id: testOrgId,
        config_id: 'config-1',
        data: testRunResult,
        started_at: '2023-01-01T10:00:00Z',
        completed_at: '2023-01-01T10:05:00Z',
        success: true,
      };
      mockClient.query.mockResolvedValue({ rows: [mockRow] });

      const result = await store.getRun(testRunResult.id, testOrgId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(testRunResult.id);
      expect(result?.success).toBe(true);
    });

    it('should list runs with optional configId filter', async () => {
      const mockRows = [{
        id: testRunResult.id,
        org_id: testOrgId,
        config_id: 'config-1',
        data: testRunResult,
        started_at: '2023-01-01T10:00:00Z',
        completed_at: '2023-01-01T10:05:00Z',
        success: true,
      }];
      
      // Mock count query and list query
      mockClient.query
        .mockResolvedValueOnce({ rows: mockRows }) // list query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // count query

      const result = await store.listRuns(10, 0, 'config-1', testOrgId);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('config_id = $2'),
        ['test-org', 'config-1', 10, 0]
      );
    });

    it('should list runs without configId filter', async () => {
      const mockRows = [{
        id: testRunResult.id,
        org_id: testOrgId,
        config_id: 'config-1',
        data: testRunResult,
        started_at: '2023-01-01T10:00:00Z',
        completed_at: '2023-01-01T10:05:00Z',
        success: true,
      }];
      
      mockClient.query
        .mockResolvedValueOnce({ rows: mockRows })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      const result = await store.listRuns(10, 0, undefined, testOrgId);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.not.stringContaining('config_id = $2'),
        [testOrgId, 10, 0]
      );
    });

    it('should create run', async () => {
      mockClient.query.mockResolvedValue({ rowCount: 1 });

      const result = await store.createRun(testRunResult, testOrgId);

      expect(mockClient.query).toHaveBeenCalledWith(
        'INSERT INTO runs (id, org_id, config_id, data, started_at, completed_at, success) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [
          testRunResult.id,
          testOrgId,
          testRunResult.config?.id,
          JSON.stringify(testRunResult),
          testRunResult.startedAt.toISOString(),
          testRunResult.completedAt.toISOString(),
          testRunResult.success,
        ]
      );
      expect(result).toEqual(testRunResult);
    });

    it('should handle date conversion in createRun', async () => {
      const runWithStringDates = {
        ...testRunResult,
        startedAt: '2023-01-01T10:00:00Z' as any,
        completedAt: '2023-01-01T10:05:00Z' as any,
      };
      mockClient.query.mockResolvedValue({ rowCount: 1 });

      await store.createRun(runWithStringDates, testOrgId);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.any(String), // id
          testOrgId,
          expect.any(String), // config_id
          expect.any(String), // data JSON
          '2023-01-01T10:00:00.000Z', // converted startedAt
          '2023-01-01T10:05:00.000Z', // converted completedAt
          expect.any(Boolean), // success
        ])
      );
    });

    it('should delete run', async () => {
      mockClient.query.mockResolvedValue({ rowCount: 1 });

      const result = await store.deleteRun(testRunResult.id, testOrgId);

      expect(result).toBe(true);
    });

    it('should delete all runs', async () => {
      mockClient.query.mockResolvedValue({ rowCount: 5 });

      const result = await store.deleteAllRuns(testOrgId);

      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM runs WHERE $1::TEXT IS NULL OR org_id = $1::TEXT RETURNING id',
        [testOrgId]
      );
      expect(result).toBe(true);
    });
  });

  describe('Tenant Information Methods', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should get tenant info', async () => {
      const mockRow = {
        email: 'test@example.com',
        email_entry_skipped: false,
      };
      mockClient.query.mockResolvedValue({ rows: [mockRow] });

      const result = await store.getTenantInfo();

      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT email, email_entry_skipped FROM tenants LIMIT 1'
      );
      expect(result).toEqual({
        email: 'test@example.com',
        emailEntrySkipped: false,
      });
    });

    it('should return default values when no tenant info exists', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      const result = await store.getTenantInfo();

      expect(result).toEqual({
        email: null,
        emailEntrySkipped: false,
      });
    });

    it('should set tenant info with email and emailEntrySkipped', async () => {
      mockClient.query.mockResolvedValue({ rowCount: 1 });

      await store.setTenantInfo('test@example.com', true);

      expect(mockClient.query).toHaveBeenCalledWith(
        'INSERT INTO tenants (email, email_entry_skipped) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET email = $1, email_entry_skipped = $2',
        ['test@example.com', true]
      );
    });

    it('should set tenant info with only email', async () => {
      mockClient.query.mockResolvedValue({ rowCount: 1 });

      await store.setTenantInfo('test@example.com');

      expect(mockClient.query).toHaveBeenCalledWith(
        'INSERT INTO tenants (email) VALUES ($1) ON CONFLICT (email) DO UPDATE SET email = $1',
        ['test@example.com']
      );
    });

    it('should set tenant info with only emailEntrySkipped', async () => {
      mockClient.query.mockResolvedValue({ rowCount: 1 });

      await store.setTenantInfo(undefined, true);

      expect(mockClient.query).toHaveBeenCalledWith(
        'INSERT INTO tenants (email_entry_skipped) VALUES ($1) ON CONFLICT (email_entry_skipped) DO UPDATE SET email_entry_skipped = $1',
        [true]
      );
    });
  });

  describe('Helper Methods', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should handle database connection errors in withClient', async () => {
      const error = new Error('Connection failed');
      mockPool.connect.mockRejectedValue(error);

      await expect(store.getApiConfig('test', testOrgId)).rejects.toThrow('Connection failed');
    });

    it('should release client even when callback throws', async () => {
      const error = new Error('Query failed');
      mockClient.query.mockRejectedValue(error);

      await expect(store.getApiConfig('test', testOrgId)).rejects.toThrow('Query failed');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should map database rows to config objects correctly', async () => {
      const mockRow = {
        id: 'test-id',
        org_id: testOrgId,
        config: {
          id: 'test-id',
          urlHost: 'https://test.com',
          method: HttpMethod.GET,
          instruction: 'Test API',
        },
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
      };
      mockClient.query.mockResolvedValue({ rows: [mockRow] });

      const result = await store.getApiConfig('test-id', testOrgId);

      expect(result).toEqual({
        id: 'test-id',
        urlHost: 'https://test.com',
        method: HttpMethod.GET,
        instruction: 'Test API',
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-02T00:00:00Z'),
      });
    });

    it('should map run result rows correctly with date handling', async () => {
      const mockRow = {
        id: 'test-run-id',
        org_id: testOrgId,
        config_id: 'config-1',
        data: {
          id: 'test-run-id',
          success: true,
          result: 'test data',
          startedAt: '2023-01-01T10:00:00Z',
          completedAt: '2023-01-01T10:05:00Z',
        },
        started_at: '2023-01-01T10:00:00Z',
        completed_at: '2023-01-01T10:05:00Z',
        success: true,
      };
      mockClient.query.mockResolvedValue({ rows: [mockRow] });

      const result = await store.getRun('test-run-id', testOrgId);

      expect(result?.startedAt).toBeInstanceOf(Date);
      expect(result?.completedAt).toBeInstanceOf(Date);
      expect(result?.startedAt?.toISOString()).toBe('2023-01-01T10:00:00.000Z');
      expect(result?.completedAt?.toISOString()).toBe('2023-01-01T10:05:00.000Z');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should handle database query errors gracefully', async () => {
      const dbError = new Error('Database connection failed');
      mockClient.query.mockRejectedValue(dbError);

      await expect(store.getApiConfig('test', testOrgId)).rejects.toThrow('Database connection failed');
    });

    it('should handle pool connection errors', async () => {
      const connectionError = new Error('Pool exhausted');
      mockPool.connect.mockRejectedValue(connectionError);

      await expect(store.listApiConfigs(10, 0, testOrgId)).rejects.toThrow('Pool exhausted');
    });

    it('should handle invalid JSON in config columns', async () => {
      const mockRow = {
        id: 'test-id',
        org_id: testOrgId,
        config: 'invalid-json',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
      };
      mockClient.query.mockResolvedValue({ rows: [mockRow] });

      // The mapRowToConfig should handle this gracefully
      const result = await store.getApiConfig('test-id', testOrgId);
      expect(result).toBeDefined();
    });
  });

  describe('Organization ID Filtering', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should handle null orgId in queries', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await store.getApiConfig('test', undefined);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        ['test', null]
      );
    });

    it('should properly filter by orgId when provided', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await store.getApiConfig('test', 'specific-org');

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        ['test', 'specific-org']
      );
    });
  });
});
