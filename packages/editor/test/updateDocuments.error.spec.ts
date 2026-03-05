import { env } from 'cloudflare:test';
import { DOCUMENT_TYPES } from 'shared/src/constants';
import { describe, it, expect, beforeEach } from 'vitest';

import { ENDPOINT_PATH, resetDocumentsTable, updateDocument } from './updateDocuments.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetDocumentsTable();
  });

  describe('Error cases', () => {
    it('Given document type is invalid When update document is called Then it returns bad request', async () => {
      const request = {
        type: 'invalid_type',
      };

      const { response } = await updateDocument(request);
      expect(response.status).toBe(400);
    });

    it('Given URL is invalid When update document is called Then it returns bad request', async () => {
      const request = {
        type: 'tos',
        url: 'invalid',
      };

      const { response } = await updateDocument(request);
      expect(response.status).toBe(400);
    });

    it('Given database schema is broken When update document is called Then it returns internal server error', async () => {
      const db = env.DB;
      await db.prepare('DROP TABLE documents').run();

      const request = {
        type: DOCUMENT_TYPES.TOS,
      };

      const { response } = await updateDocument(request);
      expect(response.status).toBe(500);
    });

    it('Given update run reports failure When update document is called Then it returns internal server error', async () => {
      const failingEnv: Partial<Env> = {
        DB: {
          prepare: () => ({
            bind: () => ({
              run: async () => ({ success: false }),
            }),
          }),
        } as unknown as D1Database,
      };

      const { response, json } = await updateDocument(
        {
          type: DOCUMENT_TYPES.TOS,
        },
        failingEnv
      );

      expect(response.status).toBe(500);
      expect(json).toEqual({
        error: 'InternalServerError',
        message: 'Failed to update document',
      });
    });
  });
});
