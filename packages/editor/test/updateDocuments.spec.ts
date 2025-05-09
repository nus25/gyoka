import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { DOCUMENT_TYPES } from 'shared/src/constants';
import app from '../src/index';

const BASE_URL = 'http://localhost:8787';
const ENDPOINT_PATH = '/api/gyoka/updateDocument';

// request helper
async function updateDocument(request: {
  type: string; // type に変更
  url?: string; // url を追加
  content?: string; // content を追加
}) {
  const req = new Request(`${BASE_URL}${ENDPOINT_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  const ctx = createExecutionContext();
  const response = await app.fetch(req, env, ctx);
  await waitOnExecutionContext(ctx);
  return {
    response,
    json: await response.json(),
  };
}

// response validation helper
function assertValidResponse(response: Response) {
  expect(response.status).toBe(200);
  expect(response.headers.get('Content-Type')).toBe('application/json');
}

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    const db = env.DB;
    await db.prepare('DELETE FROM documents').run();
  });

  it('updates document with all fields specified', async () => {
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

    // Verify database state
    const db = env.DB;
    const { results } = await db
      .prepare('SELECT * FROM documents WHERE type = ?')
      .bind(request.type)
      .all();
    expect(results.length).toBe(1);
    expect(results[0].url).toBe(request.url);
    expect(results[0].content).toBe(request.content);
  });

  it('updates document with minimum required fields', async () => {
    const request = {
      type: DOCUMENT_TYPES.PRIVACY_POLICY,
    };

    const { response, json } = await updateDocument(request);

    assertValidResponse(response);
    expect(json).toEqual({
      type: request.type,
      url: null,
      content: null,
    });
  });

  it('handles invalid document type', async () => {
    const request = {
      type: 'invalid_type',
    };

    const { response } = await updateDocument(request);
    expect(response.status).toBe(400);
  });

  it('handles invalid url', async () => {
    const request = {
      type: 'tos',
      url: 'invalid',
    };

    const { response } = await updateDocument(request);
    expect(response.status).toBe(400);
  });

  it('handles database errors gracefully', async () => {
    const db = env.DB;
    await db.prepare('DROP TABLE documents').run(); // Simulate a database error

    const request = {
      type: DOCUMENT_TYPES.TOS,
    };

    const { response } = await updateDocument(request);
    expect(response.status).toBe(500);
  });
});
