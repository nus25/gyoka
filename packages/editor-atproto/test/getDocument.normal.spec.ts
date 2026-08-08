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
        type: 'tos',
        url: 'https://example.com/tos',
        content: 'hello',
      });

      const { response, json } = await getDocument({ type: 'tos' });

      expect(response.status).toBe(200);
      expect(json).toEqual({
        type: 'tos',
        url: 'https://example.com/tos',
        content: 'hello',
      });

      expect(await findDocumentByType('tos')).toEqual({
        type: 'tos',
        url: 'https://example.com/tos',
        content: 'hello',
      });
    });
  });
});
