import { beforeEach, describe, expect, it } from 'vitest';

import { findDocumentByType } from './feedTest.shared';
import { ENDPOINT_PATH, resetFeedTables, updateDocument } from './updateDocument.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetFeedTables();
  });

  describe('Success cases', () => {
    it('Given valid document payload When updateDocument is called Then document is saved', async () => {
      const payload = {
        docType: 'tos' as const,
        url: 'https://example.com/tos',
        content: 'hello',
      };
      const { response, json } = await updateDocument(payload);

      expect(response.status).toBe(200);
      expect(json).toEqual(payload);

      const dbRow = await findDocumentByType('tos');
      expect(dbRow).toEqual({
        type: 'tos',
        url: 'https://example.com/tos',
        content: 'hello',
      });
    });
  });
});
