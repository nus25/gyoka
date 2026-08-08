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
        type: 'privacy_policy',
      });

      expect(response.status).toBe(200);
      expect(json).toEqual({
        type: 'privacy_policy',
        url: null,
        content: null,
      });

      const row = await findDocumentByType('privacy_policy');
      expect(row).toEqual({
        type: 'privacy_policy',
        url: null,
        content: null,
      });
    });
  });
});
