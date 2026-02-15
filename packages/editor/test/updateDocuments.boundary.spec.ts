import { describe, it, expect, beforeEach } from 'vitest';
import { DOCUMENT_TYPES } from 'shared/src/constants';
import {
  assertValidResponse,
  ENDPOINT_PATH,
  resetDocumentsTable,
  updateDocument,
} from './updateDocuments.shared';

describe(ENDPOINT_PATH, () => {
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
  });
});
