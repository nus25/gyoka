import { describe, it, expect } from 'vitest';

import { ENDPOINT_PATH, ping, pingWithAuth } from './ping.shared';

describe(ENDPOINT_PATH, () => {
  describe('Success cases', () => {
    it('Given no auth requirement When ping is called Then pong message is returned', async () => {
      const { response, json } = await ping();
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(json).toEqual({
        message: 'Gyoka is available',
      });
    });

    it('Given API key auth is enabled and valid key is provided When ping is called Then pong message is returned', async () => {
      const { response, json } = await pingWithAuth({
        apiKeySetting: 'secret-key',
        headerApiKey: 'secret-key',
      });

      expect(response.status).toBe(200);
      expect(json).toEqual({
        message: 'Gyoka is available',
      });
    });
  });
});
