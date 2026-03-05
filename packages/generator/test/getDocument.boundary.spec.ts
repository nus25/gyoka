import { DOCUMENT_TYPES } from 'shared/src/constants';
import { beforeEach, describe, expect, it } from 'vitest';

import { insertDocument, requestDocument, resetDocuments } from './getDocument.shared';

describe('Boundary cases', () => {
  beforeEach(async () => {
    await resetDocuments();
  });

  it('Given invalid document type When requesting document Then it returns 404 content not found', async () => {
    const response = await requestDocument('invalid_type');

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: 'NotFound',
      message: 'Content not found',
    });
  });

  it('Given row with null URL and null content When requesting document Then it returns 404', async () => {
    await insertDocument(DOCUMENT_TYPES.TOS, null, null);

    const response = await requestDocument(DOCUMENT_TYPES.TOS);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: 'NotFound',
      message: 'Document not found',
    });
  });
});
