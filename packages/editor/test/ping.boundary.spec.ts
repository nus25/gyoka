import { describe, expect, it } from 'vitest';

import { ENDPOINT_PATH, ping } from './ping.shared';

describe(ENDPOINT_PATH, () => {
  describe('Boundary cases', () => {
    it('Given ping is called multiple times When responses are compared Then both responses are successful', async () => {
      const first = await ping();
      const second = await ping();

      expect(first.response.status).toBe(200);
      expect(second.response.status).toBe(200);
      expect(first.json).toEqual(second.json);
    });
  });
});
