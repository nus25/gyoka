import { beforeEach, describe, expect, it } from 'vitest';

import { findDocumentByType } from './feedTest.shared';
import { ENDPOINT_PATH, resetFeedTables, updateDocument } from './updateDocument.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetFeedTables();
  });

  describe('Error cases', () => {
    it('Given URL exceeds lexicon max length When updateDocument is called Then bad request is returned', async () => {
      const { response, json } = await updateDocument({
        docType: 'tos',
        url: `https://example.com/${'a'.repeat(2100)}`,
      });

      expect(response.status).toBe(400);
      expect(json).toMatchObject({
        error: 'BadRequest',
      });
      expect((json as { message?: string }).message).toContain('invalid_string_length');

      expect(await findDocumentByType('tos')).toBeNull();
    });
  });
});
