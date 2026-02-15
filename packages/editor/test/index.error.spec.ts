import { describe, it, expect } from 'vitest';
import { fetchPath } from './index.shared';

describe('configuration error test', () => {
  describe('Error cases', () => {
    it('Given DB env is missing When ping endpoint is requested Then it returns internal server error', async () => {
      const response = await fetchPath('/api/gyoka/ping', {
        DB: undefined,
      });

      expect(response.status).toBe(500);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      const json = await response.json();
      expect(json).toEqual({
        error: 'InternalServerError',
        message: 'Missing database configuration',
      });
    });
  });
});
