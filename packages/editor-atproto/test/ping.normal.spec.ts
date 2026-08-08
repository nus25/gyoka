import { describe, expect, it } from 'vitest';

import { ENDPOINT_PATH, ping } from './ping.shared';

describe(ENDPOINT_PATH, () => {
  describe('Success cases', () => {
    it('Given auth is disabled When ping is called Then pong message is returned', async () => {
      const { response, json } = await ping();

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('application/json');
      expect(json).toEqual({
        message: 'Gyoka is available',
      });
    });
  });
});
