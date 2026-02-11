import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect} from 'vitest';
import app from '../src/index';
const BASE_URL = 'http://localhost:8787';

// This test suite ensures that each endpoint responds to requests as expected.

describe('document settings', () => {
  it('returns app swagger doc when enabled', async () => {
    const request = new Request(`${BASE_URL}/docs`);
    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(200);
  });
  it('returns app redoc when enabled', async () => {
    const request = new Request(`${BASE_URL}/redocs`);
    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(200);
  });

  it('returns openapi.json when enabled', async () => {
    const request = new Request(`${BASE_URL}/openapi.json`);
    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(200);
  });
});

describe('OpenAPI UI access control', () => {
  it('returns 404 for /docs when SWAGGER_UI is disabled', async () => {
    const request = new Request(`${BASE_URL}/docs`);
    const ctx = createExecutionContext();
    const disabledEnv = {
      ...env,
      SWAGGER_UI: 'disabled',
    };
    const response = await app.fetch(request, disabledEnv, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(404);
  });

  it('returns 404 for /docs when SWAGGER_UI is not set', async () => {
    const request = new Request(`${BASE_URL}/docs`);
    const ctx = createExecutionContext();
    const disabledEnv = {
      ...env,
      SWAGGER_UI: undefined,
    };
    const response = await app.fetch(request, disabledEnv, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(404);
  });

  it('returns 404 for /redocs when REDOC is disabled', async () => {
    const request = new Request(`${BASE_URL}/redocs`);
    const ctx = createExecutionContext();
    const disabledEnv = {
      ...env,
      REDOC: 'disabled',
    };
    const response = await app.fetch(request, disabledEnv, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(404);
  });

  it('returns 404 for /redocs when REDOC is not set', async () => {
    const request = new Request(`${BASE_URL}/redocs`);
    const ctx = createExecutionContext();
    const disabledEnv = {
      ...env,
      REDOC: undefined,
    };
    const response = await app.fetch(request, disabledEnv, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(404);
  });

  it('returns 200 for /openapi.json when SWAGGER_UI is enabled even if OPENAPI_JSON is disabled', async () => {
    const request = new Request(`${BASE_URL}/openapi.json`);
    const ctx = createExecutionContext();
    const enabledEnv = {
      ...env,
      SWAGGER_UI: 'enabled',
      OPENAPI_JSON: 'disabled',
    };
    const response = await app.fetch(request, enabledEnv, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(200);
  });

  it('returns 200 for /openapi.json when REDOC is enabled even if OPENAPI_JSON is disabled', async () => {
    const request = new Request(`${BASE_URL}/openapi.json`);
    const ctx = createExecutionContext();
    const enabledEnv = {
      ...env,
      REDOC: 'enabled',
      OPENAPI_JSON: 'disabled',
    };
    const response = await app.fetch(request, enabledEnv, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(200);
  });

  it('returns 404 for /openapi.json when all flags are disabled', async () => {
    const request = new Request(`${BASE_URL}/openapi.json`);
    const ctx = createExecutionContext();
    const disabledEnv = {
      ...env,
      SWAGGER_UI: 'disabled',
      REDOC: 'disabled',
      OPENAPI_JSON: 'disabled',
    };
    const response = await app.fetch(request, disabledEnv, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(404);
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
