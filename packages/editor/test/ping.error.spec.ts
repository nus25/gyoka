import { describe, expect, it } from 'vitest';

import { ENDPOINT_PATH, ping } from './ping.shared';

describe(ENDPOINT_PATH, () => {
  describe('Error cases', () => {
    it('Given auth is enabled and no bearer token is provided When ping is called Then unauthorized is returned', async () => {
      const { response, json } = await ping({
        envOverrides: {
          GYOKA_EDITOR_AUTH_REQUIRED: 'enabled',
        },
      });

      expect(response.status).toBe(401);
      expect(json).toEqual({
        error: 'AuthenticationRequired',
        message: 'Missing or invalid authentication credentials',
      });
    });
  });
});
