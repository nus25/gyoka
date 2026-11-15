import { beforeEach, describe, expect, it } from 'vitest';

import { ENDPOINT_PATH, getDocument, resetFeedTables } from './getDocument.shared';
import { updateDocument } from './updateDocument.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetFeedTables();
  });

  describe('Boundary cases', () => {
    it('Given stored document has null URL and content When getDocument is called Then null fields are returned', async () => {
      await updateDocument({
        docType: 'privacy_policy',
      });

      const { response, json } = await getDocument({ docType: 'privacy_policy' });

      expect(response.status).toBe(200);
      expect(json).toEqual({
        docType: 'privacy_policy',
        url: null,
        content: null,
      });
    });
  });
});
