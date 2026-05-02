import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { expect } from 'vitest';

import app from '../src/index';

export const BASE_URL = 'http://localhost:8787';
export const ENDPOINT_PATH = '/xrpc/app.bsky.feed.describeFeedGenerator';

export async function resetDescribeFeedGeneratorTables() {
  await env.DB.prepare('DELETE FROM documents').run();
  await env.DB.prepare('DELETE FROM feeds').run();
}

export async function requestDescribeFeedGenerator(requestEnv = env) {
  const request = new Request(`${BASE_URL}${ENDPOINT_PATH}`);
  const ctx = createExecutionContext();
  const response = await app.fetch(request, requestEnv, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

export async function requestDescribeFeedGeneratorJson(requestEnv = env) {
  const response = await requestDescribeFeedGenerator(requestEnv);
  return {
    response,
    json: await response.json(),
  };
}

export async function insertFeeds(feeds: Array<{ uri: string; is_active: number }>) {
  const placeholders = feeds.map(() => '(?, ?)').join(', ');
  const values = feeds.flatMap(({ uri, is_active }) => [uri, is_active]);
  await env.DB.prepare(`INSERT INTO feeds (feed_uri, is_active) VALUES ${placeholders}`)
    .bind(...values)
    .run();
}

export async function insertDocuments(documents: Array<{ type: string; url: string | null }>) {
  const placeholders = documents.map(() => '(?, ?)').join(', ');
  const values = documents.flatMap(({ type, url }) => [type, url]);
  await env.DB.prepare(`INSERT INTO documents (type, url) VALUES ${placeholders}`)
    .bind(...values)
    .run();
}

export function expectJson200(response: Response) {
  expect(response.status).toBe(200);
  expect(response.headers.get('Content-Type')).toBe('application/json');
}
