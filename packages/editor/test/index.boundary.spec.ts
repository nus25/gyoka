import { describe, it, expect } from 'vitest';
import { fetchPath } from './index.shared';

describe('document settings', () => {
  describe('Boundary cases', () => {
    it('Given OpenAPI endpoint is disabled in this environment When /openapi.json is requested Then it returns 404', async () => {
      const response = await fetchPath('/openapi.json');
      expect(response.status).toBe(404);
    });
  });
});
