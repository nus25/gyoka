import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import app from '../src/index';
const BASE_URL = 'http://localhost:8787';

// This test suite ensures that each endpoint responds to requests as expected.

describe('root', () => {
  it('returns app doc', async () => {
    const request = new Request(`${BASE_URL}/docs`);
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
    const noHostEnv = {
      FEEDGEN_PUBLISHER_DID: env.FEEDGEN_PUBLISHER_DID,
      FEEDGEN_HOST: undefined,
      DB: env.DB,
    };
    const response = await app.fetch(request, noHostEnv, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(500);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    const json = await response.json();
    expect(json).toEqual({
      error: 'InternalServerError',
      message: 'Missing required environment variables',
    });

    const noDidEnv = {
      FEEDGEN_PUBLISHER_DID: undefined,
      FEEDGEN_HOST: env.FEEDGEN_HOST,
      DB: env.DB,
    };
    const response2 = await app.fetch(request, noDidEnv, ctx);
    await waitOnExecutionContext(ctx);
    expect(response2.status).toBe(500);
    expect(response2.headers.get('Content-Type')).toBe('application/json');
    const json2 = await response2.json();
    expect(json2).toEqual({
      error: 'InternalServerError',
      message: 'Missing required environment variables',
    });
    const noDbEnv = {
      FEEDGEN_PUBLISHER_DID: env.FEEDGEN_PUBLISHER_DID,
      FEEDGEN_HOST: env.FEEDGEN_HOST,
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
