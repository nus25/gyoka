import type { ErrorResponse } from 'shared/src/types';

import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { expect } from 'vitest';

import app from '../src/index';

export const BASE_URL = 'http://localhost:8787';
export const TEST_API_KEY = 'test-api-key';

export async function requestJson<T>(params: {
  path: string;
  init?: RequestInit;
  envOverrides?: Partial<Env>;
}) {
  const headers = new Headers(params.init?.headers);
  if (!headers.has('X-API-Key')) {
    headers.set('X-API-Key', TEST_API_KEY);
  }

  const request = new Request(`${BASE_URL}${params.path}`, {
    ...params.init,
    headers,
  });
  const ctx = createExecutionContext();
  const response = await app.fetch(
    request,
    {
      ...env,
      GYOKA_API_KEY: TEST_API_KEY,
      ...params.envOverrides,
    },
    ctx
  );
  await waitOnExecutionContext(ctx);

  return {
    response,
    json: (await response.json()) as T,
  };
}

export function expectJsonResponse(response: Response, status = 200) {
  expect(response.status).toBe(status);
  expect(response.headers.get('Content-Type')).toBe('application/json');
}

export async function clearTables(tableNames: string[]) {
  for (const tableName of tableNames) {
    await env.DB.prepare(`DELETE FROM ${tableName}`).run();
  }
}

export function assertErrorResponse(response: unknown): asserts response is ErrorResponse {
  expect(response).toMatchObject({
    error: expect.any(String),
  });
}
