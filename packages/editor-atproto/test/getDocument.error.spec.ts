import { beforeEach, describe, expect, it } from 'vitest';

import { ENDPOINT_PATH, getDocument, resetFeedTables } from './getDocument.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetFeedTables();
  });

  describe('Error cases', () => {
    it('Given invalid document type When getDocument is called Then bad request is returned', async () => {
      const { response, json } = await getDocument({ type: 'invalid_type' });

      expect(response.status).toBe(400);
      expect(json).toEqual({
        error: 'BadRequest',
        message: 'Invalid document type',
      });
    });

    it('Given no stored document exists When getDocument is called Then not found is returned', async () => {
      const { response, json } = await getDocument({ type: 'tos' });

      expect(response.status).toBe(404);
      expect(json).toEqual({
        error: 'NotFound',
        message: 'Document not found',
      });
    });

    it('Given document query throws exception When getDocument is called Then internal server error is returned', async () => {
      const throwingDb = {
        prepare: () => ({
          bind: () => ({
            all: async () => {
              throw new Error('SQLITE_ERROR: no such table: documents');
            },
          }),
        }),
      } as unknown as D1Database;

      const { response, json } = await getDocument({ type: 'tos' }, { DB: throwingDb });

      expect(response.status).toBe(500);
      expect(json).toEqual({
        error: 'InternalServerError',
        message: 'Failed to fetch document',
      });
    });
  });
});
