import { describe, it, expect } from 'vitest';

import { fetchPath } from './index.shared';

describe('document settings', () => {
  describe('Success cases', () => {
    it('Given docs route is disabled When /docs is requested Then it returns 404', async () => {
      const response = await fetchPath('/docs');
      expect(response.status).toBe(404);
    });

    it('Given redocs route is disabled When /redocs is requested Then it returns 404', async () => {
      const response = await fetchPath('/redocs');
      expect(response.status).toBe(404);
    });
  });
});
