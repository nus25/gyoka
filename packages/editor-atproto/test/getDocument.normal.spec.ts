import { beforeEach, describe, expect, it } from 'vitest';

import { findDocumentByType } from './feedTest.shared';
import { ENDPOINT_PATH, getDocument, resetFeedTables } from './getDocument.shared';
import { updateDocument } from './updateDocument.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetFeedTables();
  });

  describe('Success cases', () => {
    it('Given stored document exists When getDocument is called Then document payload is returned', async () => {
      await updateDocument({
        docType: 'tos',
        url: 'https://example.com/tos',
        content: 'hello',
      });

      const { response, json } = await getDocument({ docType: 'tos' });

      expect(response.status).toBe(200);
      expect(json).toEqual({
        docType: 'tos',
        url: 'https://example.com/tos',
        content: 'hello',
      });
      // Verify that the document was actually stored in the database
      expect(await findDocumentByType('tos')).toEqual({
        type: 'tos',
        url: 'https://example.com/tos',
        content: 'hello',
      });
    });
  });
});
