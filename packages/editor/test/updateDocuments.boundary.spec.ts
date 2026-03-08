import { DOCUMENT_TYPES } from 'shared/src/constants';
import { describe, it, expect, beforeEach } from 'vitest';

import {
  assertValidResponse,
  ENDPOINT_PATH,
  resetDocumentsTable,
  updateDocument,
} from './updateDocuments.shared';

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

  describe('Boundary cases', () => {
    it('Given only required fields are provided When update document is called Then nullable fields are stored as null', async () => {
      const request = {
        type: DOCUMENT_TYPES.PRIVACY_POLICY,
      };

      const { response, json } = await updateDocument(request);

      assertValidResponse(response);
      expect(json).toEqual({
        type: request.type,
        url: null,
        content: null,
      });
    });

    it('Given URL and content are at maximum length When update document is called Then it accepts the payload', async () => {
      const request = {
        type: DOCUMENT_TYPES.TOS,
        url: createValidUrlWithLength(MAX_URL_LENGTH),
        content: 'a'.repeat(MAX_CONTENT_LENGTH),
      };

      const { response, json } = await updateDocument(request);

      assertValidResponse(response);
      expect(json).toEqual(request);
    });
  });
});
