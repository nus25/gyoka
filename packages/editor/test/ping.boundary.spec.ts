import { describe, it, expect } from 'vitest';
import { ENDPOINT_PATH, pingWithAuth } from './ping.shared';

describe(ENDPOINT_PATH, () => {
  describe('Boundary cases', () => {
    it('Given API key auth is disabled and no header is provided When ping is called Then request is allowed', async () => {
      const { response, json } = await pingWithAuth({
        apiKeySetting: undefined,
      });

      expect(response.status).toBe(200);
      expect(json).toEqual({
        message: 'Gyoka is available',
      });
    });
  });
});
