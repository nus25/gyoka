import { beforeEach, describe, expect, it } from 'vitest';

import { updateDocument as updateDocumentEndpoint } from '../src/endpoints/updateDocument';
import { findDocumentByType } from './feedTest.shared';
import { ENDPOINT_PATH, resetFeedTables, updateDocument } from './updateDocument.shared';

function createDb(run: () => Promise<{ success: boolean }>): Env['DB'] {
  return {
    prepare: () => ({
      bind: () => ({ run }),
    }),
  } as unknown as Env['DB'];
}

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

    it('Given content exceeds the handler limit When updateDocument endpoint is called Then bad request is thrown', async () => {
      await expect(
        updateDocumentEndpoint(
          createDb(async () => ({ success: true })),
          {
            docType: 'tos',
            content: 'a'.repeat(32_769),
          }
        )
      ).rejects.toMatchObject({ errorCode: 'BadRequest' });
    });

    it('Given URL exceeds the handler limit When updateDocument endpoint is called Then bad request is thrown', async () => {
      await expect(
        updateDocumentEndpoint(
          createDb(async () => ({ success: true })),
          {
            docType: 'tos',
            url: `https://example.com/${'a'.repeat(2048)}`,
          }
        )
      ).rejects.toMatchObject({ errorCode: 'BadRequest' });
    });

    it('Given database update reports failure When updateDocument endpoint is called Then internal server error is thrown', async () => {
      await expect(
        updateDocumentEndpoint(
          createDb(async () => ({ success: false })),
          { docType: 'tos' }
        )
      ).rejects.toMatchObject({ errorCode: 'InternalServerError' });
    });

    it('Given database update throws When updateDocument endpoint is called Then internal server error is thrown', async () => {
      await expect(
        updateDocumentEndpoint(
          createDb(async () => {
            throw new Error('database unavailable');
          }),
          { docType: 'tos' }
        )
      ).rejects.toMatchObject({ errorCode: 'InternalServerError' });
    });
  });
});
