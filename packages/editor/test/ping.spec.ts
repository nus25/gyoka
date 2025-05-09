import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import app from '../src/index';

const BASE_URL = 'http://localhost:8787';
const ENDPOINT_PATH = '/api/gyoka/ping';

// request helper
async function ping() {
  const request = new Request(`${BASE_URL}${ENDPOINT_PATH}`);
  const ctx = createExecutionContext();
  const response = await app.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return {
    response,
    json: await response.json(),
  };
}

describe(ENDPOINT_PATH, async () => {
  it('returns pong message', async () => {
    const { response, json } = await ping();
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(json).toEqual({
      message: 'Gyoka is available',
    });
  });
});
