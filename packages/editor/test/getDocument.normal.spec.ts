import { beforeEach, describe, expect, it, vi } from 'vitest';

import { findDocumentByType } from './feedTest.shared';
import { ENDPOINT_PATH, getDocument, resetFeedTables } from './getDocument.shared';
import { updateDocument } from './updateDocument.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetFeedTables();
  });

  describe('Success cases', () => {
    it('Given a document When fetching it in developer mode Then the summary excludes its content and URL', async () => {
      await updateDocument({
        docType: 'tos',
        url: 'https://example.com/private',
        content: 'private text',
      });
      const output = vi.spyOn(console, 'log').mockImplementation(() => {});
      try {
        const { response } = await getDocument({ docType: 'tos' }, { DEVELOPER_MODE: 'enabled' });
        expect(response.status).toBe(200);
        const records = output.mock.calls.map(([line]) => JSON.parse(String(line)));
        expect(records).toContainEqual(
          expect.objectContaining({
            event: 'document.get.document.success',
            docType: 'tos',
            hasUrl: true,
            hasContent: true,
          })
        );
        expect(JSON.stringify(records)).not.toContain('private');
      } finally {
        output.mockRestore();
      }
    });

    it('Given stored document exists When getDocument is called Then document payload is returned', async () => {
      await updateDocument({
        docType: 'tos',
        url: 'https://example.com/tos',
        content: 'hello',
      });

      const { response, json } = await getDocument({ docType: 'tos' });

      expect(response.status).toBe(200);
      expect(json).toEqual({
        docType: 'tos',
        url: 'https://example.com/tos',
        content: 'hello',
      });
      // Verify that the document was actually stored in the database
      expect(await findDocumentByType('tos')).toEqual({
        type: 'tos',
        url: 'https://example.com/tos',
        content: 'hello',
      });
    });
  });
});
