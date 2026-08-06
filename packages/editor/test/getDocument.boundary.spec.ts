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

  describe('Boundary cases', () => {
    it('Given document exists with null URL and null content When get document is called Then null fields are returned', async () => {
      await insertDocument(DOCUMENT_TYPES.PRIVACY_POLICY, null, null);

      const { response, json } = await getDocument(DOCUMENT_TYPES.PRIVACY_POLICY);

      assertValidResponse(response);
      expect(json).toEqual({
        type: DOCUMENT_TYPES.PRIVACY_POLICY,
        url: null,
        content: null,
      });
    });

    it('Given document type is tos When get document is called Then tos document is returned', async () => {
      await insertDocument(DOCUMENT_TYPES.TOS, null, 'Only content');

      const { response, json } = await getDocument(DOCUMENT_TYPES.TOS);

      assertValidResponse(response);
      expect(json).toEqual({
        type: DOCUMENT_TYPES.TOS,
        url: null,
        content: 'Only content',
      });
    });
  });
});
