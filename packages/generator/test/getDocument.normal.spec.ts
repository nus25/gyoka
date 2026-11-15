import { env } from 'cloudflare:workers';
import { DOCUMENT_TYPES } from 'shared/src/constants';
import { beforeEach, describe, expect, it } from 'vitest';

import { getDocument } from '../src/endpoints/getDocument';
import { insertDocument, requestDocument, resetDocuments } from './getDocument.shared';

describe('Success cases', () => {
  beforeEach(async () => {
    await resetDocuments();
  });

  it('Given a document When requesting it Then diagnostic context contains presence flags without content', async () => {
    await insertDocument(DOCUMENT_TYPES.TOS, 'https://example.com/private', 'private content');
    const context: Record<string, unknown> = {};
    const response = await getDocument(env, DOCUMENT_TYPES.TOS, context);
    expect(response.status).toBe(200);
    expect(context).toMatchObject({ docType: 'tos', hasUrl: true, hasContent: true });
    expect(JSON.stringify(context)).not.toContain('private');
  });

  it('Given content only document When requesting document Then it returns content body', async () => {
    await insertDocument(DOCUMENT_TYPES.PRIVACY_POLICY, null, 'Test content');

    const response = await requestDocument(DOCUMENT_TYPES.PRIVACY_POLICY);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/plain');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(await response.text()).toBe('Test content');
  });

  it('Given URL only document When requesting document Then it returns URL guide text', async () => {
    await insertDocument(DOCUMENT_TYPES.TOS, 'http://example.com', null);

    const response = await requestDocument(DOCUMENT_TYPES.TOS);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/plain');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(await response.text()).toBe('See document at http://example.com');
  });

  it('Given URL and content document When requesting document Then it returns both URL and content', async () => {
    await insertDocument(
      DOCUMENT_TYPES.TOS,
      'http://example.com/terms',
      'Terms of Service content'
    );

    const response = await requestDocument(DOCUMENT_TYPES.TOS);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/plain');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    const responseText = await response.text();
    expect(responseText).toContain('You can view the document at http://example.com/terms');
    expect(responseText).toContain('Terms of Service content');
  });
});
