import { describe, expect, it } from 'vitest';

import { ENDPOINT_PATH, getDidDocument } from './getDidDocument.shared';

describe(ENDPOINT_PATH, () => {
  describe('Error cases', () => {
    it('Given host env var is missing When did document endpoint is called Then it returns internal server error', async () => {
      const { response, json } = await getDidDocument({
        GYOKA_EDITOR_HOST: '' as unknown as Env['GYOKA_EDITOR_HOST'],
      });

      expect(response.status).toBe(500);
      expect(json).toEqual({
        error: 'InternalServerError',
        message: 'Missing required environment variables',
      });
    });
  });
});
