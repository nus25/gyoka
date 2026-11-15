import { beforeEach, describe, expect, it } from 'vitest';

import { findDocumentByType } from './feedTest.shared';
import { ENDPOINT_PATH, resetFeedTables, updateDocument } from './updateDocument.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetFeedTables();
  });

  describe('Boundary cases', () => {
    it('Given nullable fields are omitted When updateDocument is called Then nulls are persisted', async () => {
      const { response, json } = await updateDocument({
        docType: 'privacy_policy',
      });

      expect(response.status).toBe(200);
      expect(json).toEqual({
        docType: 'privacy_policy',
        url: null,
        content: null,
      });

      const dbRow = await findDocumentByType('privacy_policy');
      expect(dbRow).toEqual({
        type: 'privacy_policy',
        url: null,
        content: null,
      });
    });
  });
});
