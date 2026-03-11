import { describe, it, expect } from 'vitest';

import { ENDPOINT_PATH, pingWithAuth } from './ping.shared';

describe(ENDPOINT_PATH, () => {
  describe('Boundary cases', () => {
    it('Given API key auth is not configured When ping is called Then internal server error is returned', async () => {
      const { response, json } = await pingWithAuth({
        apiKeySetting: undefined,
      });

      expect(response.status).toBe(500);
      expect(json).toEqual({
        error: 'InternalServerError',
        message: 'Missing authentication configuration',
      });
    });
  });
});
