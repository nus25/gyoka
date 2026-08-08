import { DOCUMENT_TYPES } from 'shared/src/constants';
import { beforeEach, describe, expect, it } from 'vitest';

import { ENDPOINT_PATH, getDocument, resetDocumentsTable } from './getDocument.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetDocumentsTable();
  });

  describe('Error cases', () => {
    it('Given document type is invalid When get document is called Then it returns bad request', async () => {
      const { response } = await getDocument('invalid_type');

      expect(response.status).toBe(400);
    });

    it('Given document does not exist When get document is called Then it returns not found', async () => {
      const { response, json } = await getDocument(DOCUMENT_TYPES.TOS);

      expect(response.status).toBe(404);
      expect(json).toEqual({
        error: 'NotFound',
        message: 'Document not found',
      });
    });

    it('Given select operation throws exception When get document is called Then it returns internal server error', async () => {
      const throwingEnv: Partial<Env> = {
        DB: {
          prepare: () => ({
            bind: () => ({
              all: async () => {
                throw new Error('SQLITE_ERROR: no such table: documents');
              },
            }),
          }),
        } as unknown as D1Database,
      };

      const { response, json } = await getDocument(DOCUMENT_TYPES.TOS, throwingEnv);

      expect(response.status).toBe(500);
      expect(json).toEqual({
        error: 'InternalServerError',
        message: 'Failed to fetch document',
      });
    });
  });
});
