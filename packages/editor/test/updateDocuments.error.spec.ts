import { env } from 'cloudflare:test';
import { DOCUMENT_TYPES } from 'shared/src/constants';
import { describe, it, expect, beforeEach } from 'vitest';

import { ENDPOINT_PATH, resetDocumentsTable, updateDocument } from './updateDocuments.shared';

describe(ENDPOINT_PATH, () => {
  const MAX_URL_LENGTH = 2048;
  const MAX_CONTENT_LENGTH = 32768;

  function createValidUrlWithLength(targetLength: number): string {
    const prefix = 'https://example.com/';
    const suffixLength = targetLength - prefix.length;
    return `${prefix}${'a'.repeat(suffixLength)}`;
  }

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

    it('Given URL exceeds maximum length When update document is called Then it returns bad request', async () => {
      const request = {
        type: DOCUMENT_TYPES.TOS,
        url: createValidUrlWithLength(MAX_URL_LENGTH + 1),
      };

      const { response } = await updateDocument(request);
      expect(response.status).toBe(400);
    });

    it('Given content exceeds maximum length When update document is called Then it returns bad request', async () => {
      const request = {
        type: DOCUMENT_TYPES.TOS,
        content: 'a'.repeat(MAX_CONTENT_LENGTH + 1),
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
