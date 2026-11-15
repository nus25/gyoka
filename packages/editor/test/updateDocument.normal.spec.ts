import { beforeEach, describe, expect, it, vi } from 'vitest';

import { findDocumentByType } from './feedTest.shared';
import { ENDPOINT_PATH, resetFeedTables, updateDocument } from './updateDocument.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetFeedTables();
  });

  describe('Success cases', () => {
    it('Given developer mode When updating a document Then debug logs contain only its type and presence flags', async () => {
      const output = vi.spyOn(console, 'log').mockImplementation(() => {});
      try {
        const { response } = await (
          await import('./feedTest.shared')
        ).callProcedure(
          ENDPOINT_PATH,
          { docType: 'tos', url: 'https://example.com/private', content: 'private document text' },
          { DEVELOPER_MODE: 'enabled' }
        );
        expect(response.status).toBe(200);
        const records = output.mock.calls.map(([line]) => JSON.parse(String(line)));
        expect(records).toContainEqual(
          expect.objectContaining({
            level: 'debug',
            event: 'document.update.document.success',
            docType: 'tos',
            hasUrl: true,
            hasContent: true,
          })
        );
        expect(JSON.stringify(records)).not.toContain('private document text');
        expect(JSON.stringify(records)).not.toContain('https://example.com/private');
      } finally {
        output.mockRestore();
      }
    });

    it('Given a document containing private text When updating it Then logs do not contain the document or URL', async () => {
      const output = vi.spyOn(console, 'log').mockImplementation(() => {});
      try {
        const { response } = await updateDocument({
          docType: 'tos',
          url: 'https://example.com/private',
          content: 'private document text',
        });
        expect(response.status).toBe(200);
        expect(JSON.stringify(output.mock.calls)).not.toContain('private document text');
        expect(JSON.stringify(output.mock.calls)).not.toContain('https://example.com/private');
      } finally {
        output.mockRestore();
      }
    });

    it('Given valid document payload When updateDocument is called Then document is saved', async () => {
      const payload = {
        docType: 'tos' as const,
        url: 'https://example.com/tos',
        content: 'hello',
      };
      const { response, json } = await updateDocument(payload);

      expect(response.status).toBe(200);
      expect(json).toEqual(payload);

      const dbRow = await findDocumentByType('tos');
      expect(dbRow).toEqual({
        type: 'tos',
        url: 'https://example.com/tos',
        content: 'hello',
      });
    });
  });
});
