import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { expect } from 'vitest';

import app from '../src/index';

export const BASE_URL = 'http://localhost:8787';

export async function requestPath(path: string, init?: RequestInit, requestEnv?: Env) {
  const request = new Request(`${BASE_URL}${path}`, init);
  const ctx = createExecutionContext();
  const response = await app.fetch(request, requestEnv ?? env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

export function expectJsonResponse(response: Response, status = 200) {
  expect(response.status).toBe(status);
  expect(response.headers.get('Content-Type')).toContain('application/json');
}

export async function clearTables(tableNames: string[]) {
  for (const tableName of tableNames) {
    await env.DB.prepare(`DELETE FROM ${tableName}`).run();
  }
}
