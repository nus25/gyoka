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

    it('Given auth is enabled and admin DID list contains an invalid DID When did document endpoint is called Then it returns internal server error', async () => {
      const { response, json } = await getDidDocument({
        GYOKA_EDITOR_AUTH_REQUIRED: 'enabled',
        GYOKA_EDITOR_ADMIN_DIDS: ['did:plc:validadmin000000000000000000', 'not-a-did'],
      });

      expect(response.status).toBe(500);
      expect(json).toEqual({
        error: 'InternalServerError',
        message: 'Invalid required environment variables',
      });
    });
  });
});
