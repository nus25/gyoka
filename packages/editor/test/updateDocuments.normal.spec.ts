import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  assertValidResponse,
  ENDPOINT_PATH,
  resetDocumentsTable,
  updateDocument,
} from './updateDocuments.shared';
import { DOCUMENT_TYPES } from 'shared/src/constants';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetDocumentsTable();
  });

  describe('Success cases', () => {
    it('Given all fields are provided When update document is called Then document is persisted with provided values', async () => {
      const request = {
        type: DOCUMENT_TYPES.TOS,
        url: 'http://example.com/tos',
        content: 'Updated Terms of Service',
      };

      const { response, json } = await updateDocument(request);

      assertValidResponse(response);
      expect(json).toEqual({
        type: request.type,
        url: request.url,
        content: request.content,
      });

      const db = env.DB;
      const { results } = await db
        .prepare('SELECT * FROM documents WHERE type = ?')
        .bind(request.type)
        .all();
      expect(results.length).toBe(1);
      expect(results[0].url).toBe(request.url);
      expect(results[0].content).toBe(request.content);
    });
  });
});
