import { describe, it, expect } from 'vitest';

import { ENDPOINT_PATH, pingWithAuth } from './ping.shared';

describe(ENDPOINT_PATH, () => {
  describe('Error cases', () => {
    it('Given API key auth is enabled and header is missing When ping is called Then unauthorized is returned', async () => {
      const { response, json } = await pingWithAuth({
        apiKeySetting: 'secret-key',
      });

      expect(response.status).toBe(401);
      expect(json).toEqual({
        error: 'Unauthorized',
        message: 'Authentication credentials were missing or invalid.',
      });
    });

    it('Given API key auth is enabled and header key is invalid When ping is called Then unauthorized is returned', async () => {
      const { response, json } = await pingWithAuth({
        apiKeySetting: 'secret-key',
        headerApiKey: 'wrong-key',
      });

      expect(response.status).toBe(401);
      expect(json).toEqual({
        error: 'Unauthorized',
        message: 'Authentication credentials were missing or invalid.',
      });
    });
  });
});
