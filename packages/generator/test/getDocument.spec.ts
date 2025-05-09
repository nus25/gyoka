import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/index';
import { DOCUMENT_TYPES } from 'shared/src/constants';

const BASE_URL = 'http://localhost:8787';
const ENDPOINT_PATH = '/doc';

describe('GET /doc/{type}', () => {
  beforeEach(async () => {
    const db = env.DB;
    await db.prepare('DELETE FROM documents').run();
  });

  it('returns 200 and document content when only content exists', async () => {
    const url = null;
    const content = 'Test content';
    const type = DOCUMENT_TYPES.PRIVACY_POLICY;
    env.DB.prepare('INSERT INTO documents (type, url, content) VALUES (?, ?, ?)')
      .bind(type, url, content)
      .run();

    const request = new Request(`${BASE_URL}${ENDPOINT_PATH}/${DOCUMENT_TYPES.PRIVACY_POLICY}`);
    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('Test content');
  });

  it('returns 200 and URL when only URL exists', async () => {
    const url = 'http://example.com';
    const content = null;
    const type = DOCUMENT_TYPES.TOS;
    env.DB.prepare('INSERT INTO documents (type, url, content) VALUES (?, ?, ?)')
      .bind(type, url, content)
      .run();

    const request = new Request(`${BASE_URL}${ENDPOINT_PATH}/${DOCUMENT_TYPES.TOS}`);
    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('See document at http://example.com');
  });

  it('returns 404 when document not found', async () => {
    const request = new Request(`${BASE_URL}${ENDPOINT_PATH}/${DOCUMENT_TYPES.PRIVACY_POLICY}`);
    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(404);
  });

  it('returns 404 for invalid document type', async () => {
    const request = new Request(`${BASE_URL}${ENDPOINT_PATH}/invalid_type`);
    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(404);
  });

  it('returns 200 and both URL and content when both exist', async () => {
    const url = 'http://example.com/terms';
    const content = 'Terms of Service content';
    const type = DOCUMENT_TYPES.TOS;
    env.DB.prepare('INSERT INTO documents (type, url, content) VALUES (?, ?, ?)')
      .bind(type, url, content)
      .run();

    const request = new Request(`${BASE_URL}${ENDPOINT_PATH}/${DOCUMENT_TYPES.TOS}`);
    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const responseText = await response.text();
    expect(responseText).toContain('You can view the document at http://example.com/terms');
    expect(responseText).toContain('Terms of Service content');
  });
});
