import { DOCUMENT_TYPES } from 'shared/src/constants';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  assertValidResponse,
  ENDPOINT_PATH,
  getDocument,
  insertDocument,
  resetDocumentsTable,
} from './getDocument.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetDocumentsTable();
  });

  describe('Success cases', () => {
    it('Given document exists with URL and content When get document is called Then persisted values are returned', async () => {
      await insertDocument(
        DOCUMENT_TYPES.TOS,
        'http://example.com/tos',
        'Terms of Service content'
      );

      const { response, json } = await getDocument(DOCUMENT_TYPES.TOS);

      assertValidResponse(response);
      expect(json).toEqual({
        type: DOCUMENT_TYPES.TOS,
        url: 'http://example.com/tos',
        content: 'Terms of Service content',
      });
    });
  });
});
