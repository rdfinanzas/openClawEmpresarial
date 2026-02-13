import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthorizationQueue } from './authorization-queue.js';

describe('AuthorizationQueue', () => {
  let queue: AuthorizationQueue;

  beforeEach(() => {
    queue = new AuthorizationQueue({
      defaultTimeoutMs: 1000, // 1 segundo para tests
      cleanupIntervalMs: 500, // 500ms para tests
    });
  });

  afterEach(() => {
    queue.clear();
  });

  describe('enqueue and approve', () => {
    it('should enqueue a request and approve it', async () => {
      const promise = queue.enqueue('delete_file', { path: '/test.txt' });
      
      const pending = queue.getPending();
      expect(pending).toHaveLength(1);
      expect(pending[0].operation).toBe('delete_file');
      expect(pending[0].status).toBe('pending');

      const approved = queue.approve(pending[0].id);
      expect(approved).toBe(true);

      const result = await promise;
      expect(result).toBe(true);

      const status = queue.getStatus(pending[0].id);
      expect(status?.status).toBe('approved');
    });

    it('should handle multiple requests', async () => {
      const promise1 = queue.enqueue('operation1', { data: 1 });
      const promise2 = queue.enqueue('operation2', { data: 2 });

      const pending = queue.getPending();
      expect(pending).toHaveLength(2);

      queue.approve(pending[0].id);
      queue.approve(pending[1].id);

      const [result1, result2] = await Promise.all([promise1, promise2]);
      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });
  });

  describe('enqueue and reject', () => {
    it('should enqueue a request and reject it', async () => {
      const promise = queue.enqueue('delete_file', { path: '/test.txt' });
      
      const pending = queue.getPending();
      const rejected = queue.reject(pending[0].id, 'User denied');
      expect(rejected).toBe(true);

      const result = await promise;
      expect(result).toBe(false);

      const status = queue.getStatus(pending[0].id);
      expect(status?.status).toBe('rejected');
      expect(status?.rejectionReason).toBe('User denied');
    });
  });

  describe('timeout and expiration', () => {
    it('should expire a request after timeout', async () => {
      const promise = queue.enqueue('slow_operation', { data: 'test' }, 100);

      await expect(promise).rejects.toThrow('Authorization request expired');

      const pending = queue.getPending();
      expect(pending).toHaveLength(0);
    });

    it('should not approve an expired request', async () => {
      const promise = queue.enqueue('operation', {}, 100);
      
      const pending = queue.getPending();
      const requestId = pending[0].id;

      // Esperar a que expire
      await expect(promise).rejects.toThrow();

      // Intentar aprobar después de expirar
      const approved = queue.approve(requestId);
      expect(approved).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return request status', async () => {
      const promise = queue.enqueue('test_op', { value: 123 });
      
      const pending = queue.getPending();
      const status = queue.getStatus(pending[0].id);

      expect(status).toBeDefined();
      expect(status?.operation).toBe('test_op');
      expect(status?.params).toEqual({ value: 123 });
      expect(status?.status).toBe('pending');

      queue.approve(pending[0].id);
      await promise;

      const finalStatus = queue.getStatus(pending[0].id);
      expect(finalStatus?.status).toBe('approved');
    });

    it('should return undefined for non-existent request', () => {
      const status = queue.getStatus('non_existent_id');
      expect(status).toBeUndefined();
    });
  });

  describe('getPending', () => {
    it('should return only pending requests', async () => {
      const promise1 = queue.enqueue('op1', {});
      const promise2 = queue.enqueue('op2', {});
      queue.enqueue('op3', {});

      let pending = queue.getPending();
      expect(pending).toHaveLength(3);

      queue.approve(pending[0].id);
      queue.reject(pending[1].id);

      pending = queue.getPending();
      expect(pending).toHaveLength(1);
      expect(pending[0].operation).toBe('op3');

      await promise1;
      await promise2;
    });

    it('should return requests sorted by timestamp', async () => {
      // Agregar pequeño delay entre requests
      queue.enqueue('first', {});
      await new Promise(resolve => setTimeout(resolve, 10));
      queue.enqueue('second', {});
      await new Promise(resolve => setTimeout(resolve, 10));
      queue.enqueue('third', {});

      const pending = queue.getPending();
      expect(pending[0].operation).toBe('first');
      expect(pending[1].operation).toBe('second');
      expect(pending[2].operation).toBe('third');
    });
  });

  describe('getAll', () => {
    it('should return all requests regardless of status', async () => {
      const promise1 = queue.enqueue('op1', {});
      const promise2 = queue.enqueue('op2', {});
      queue.enqueue('op3', {});

      const pending = queue.getPending();
      queue.approve(pending[0].id);
      queue.reject(pending[1].id);

      const all = queue.getAll();
      expect(all).toHaveLength(3);
      
      const statuses = all.map(r => r.status);
      expect(statuses).toContain('approved');
      expect(statuses).toContain('rejected');
      expect(statuses).toContain('pending');

      await promise1;
      await promise2;
    });
  });

  describe('cleanup', () => {
    it('should clean up old completed requests', async () => {
      vi.useFakeTimers();

      const promise = queue.enqueue('test', {});
      const pending = queue.getPending();
      queue.approve(pending[0].id);
      await promise;

      // Avanzar tiempo 2 horas
      vi.advanceTimersByTime(2 * 60 * 60 * 1000);

      // Trigger cleanup manualmente
      (queue as any).cleanup();

      const all = queue.getAll();
      expect(all).toHaveLength(0);

      vi.useRealTimers();
    });
  });

  describe('custom timeout', () => {
    it('should use custom timeout when provided', async () => {
      const promise = queue.enqueue('custom_timeout', {}, 50);

      await expect(promise).rejects.toThrow();
    });
  });

  describe('clear', () => {
    it('should clear all requests and stop cleanup', () => {
      queue.enqueue('op1', {});
      queue.enqueue('op2', {});

      expect(queue.getAll()).toHaveLength(2);

      queue.clear();

      expect(queue.getAll()).toHaveLength(0);
      expect((queue as any).cleanupInterval).toBeNull();
    });
  });
});
