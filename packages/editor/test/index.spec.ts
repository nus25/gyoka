import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect} from 'vitest';
import app from '../src/index';
const BASE_URL = 'http://localhost:8787';

// This test suite ensures that each endpoint responds to requests as expected.

describe('document settings', () => {
  it('returns app swagger doc', async () => {
    const request = new Request(`${BASE_URL}/docs`);
    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(200);
  });
  it('returns app redoc', async () => {
    const request = new Request(`${BASE_URL}/redocs`);
    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(200);
  });

  it('returns openapi.json', async () => {
    const request = new Request(`${BASE_URL}/openapi.json`);
    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(200);
  });

});

describe('configuration error test', () => {
  const ENDPOINT_PATH = '/api/gyoka/ping';
  it('returns 500 if env is not set', async () => {
    const request = new Request(`${BASE_URL}${ENDPOINT_PATH}`);
    const ctx = createExecutionContext();

    const noDbEnv = {
      DB: undefined,
    };
    const response3 = await app.fetch(request, noDbEnv, ctx);
    await waitOnExecutionContext(ctx);
    expect(response3.status).toBe(500);
    expect(response3.headers.get('Content-Type')).toBe('application/json');
    const json3 = await response3.json();
    expect(json3).toEqual({
      error: 'InternalServerError',
      message: 'Missing database configuration',
    });
  });
});
