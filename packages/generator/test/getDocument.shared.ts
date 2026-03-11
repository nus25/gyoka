import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';

import app from '../src/index';

export const BASE_URL = 'http://localhost:8787';
export const DOC_ENDPOINT_PATH = '/doc';

export async function resetDocuments() {
  await env.DB.prepare('DELETE FROM documents').run();
}

export async function insertDocument(type: string, url: string | null, content: string | null) {
  await env.DB.prepare('INSERT INTO documents (type, url, content) VALUES (?, ?, ?)')
    .bind(type, url, content)
    .run();
}

export async function requestDocument(type: string, requestEnv = env) {
  const request = new Request(`${BASE_URL}${DOC_ENDPOINT_PATH}/${type}`);
  const ctx = createExecutionContext();
  const response = await app.fetch(request, requestEnv, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}
