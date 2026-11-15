import { DOCUMENT_TYPES } from 'shared/src/constants';
import { beforeEach, describe, expect, it } from 'vitest';

import { requestDocument, resetDocuments } from './getDocument.shared';

describe('Error cases', () => {
  beforeEach(async () => {
    await resetDocuments();
  });

  it('Given no document row When requesting existing document type Then it returns 404', async () => {
    const response = await requestDocument(DOCUMENT_TYPES.PRIVACY_POLICY);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: 'NotFound',
      message: 'Document not found',
    });
  });
});
