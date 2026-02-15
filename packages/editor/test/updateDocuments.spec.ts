import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { DOCUMENT_TYPES } from 'shared/src/constants';
import { clearTables, expectJsonResponse, requestJson } from './testUtils';

const ENDPOINT_PATH = '/api/gyoka/updateDocument';

// request helper
async function updateDocument(request: {
  type: string; // type に変更
  url?: string; // url を追加
  content?: string; // content を追加
}, envOverrides?: Partial<Env>) {
  return requestJson<{ type?: string; url?: string | null; content?: string | null; error?: string }>(
    {
      path: ENDPOINT_PATH,
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      },
      envOverrides,
    }
  );
}

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await clearTables(['documents']);
  });

  it('updates document with all fields specified', async () => {
    const request = {
      type: DOCUMENT_TYPES.TOS,
      url: 'http://example.com/tos',
      content: 'Updated Terms of Service',
    };

    const { response, json } = await updateDocument(request);

    expectJsonResponse(response);
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

    expectJsonResponse(response);
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

  it('returns InternalServerError when document update run reports failure', async () => {
    const failingEnv: Partial<Env> = {
      DB: {
        prepare: () => ({
          bind: () => ({
            run: async () => ({ success: false }),
          }),
        }),
      } as unknown as D1Database,
    };

    const { response, json } = await updateDocument(
      {
        type: DOCUMENT_TYPES.TOS,
      },
      failingEnv
    );

    expect(response.status).toBe(500);
    expect(json).toEqual({
      error: 'InternalServerError',
      message: 'Failed to update document',
    });
  });
});
