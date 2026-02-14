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

async function pingWithAuth(options: {
  apiKeySetting?: string | undefined;
  headerApiKey?: string;
}) {
  const headers: Record<string, string> = {};
  if (options.headerApiKey !== undefined) {
    headers['X-API-Key'] = options.headerApiKey;
  }

  const request = new Request(`${BASE_URL}${ENDPOINT_PATH}`, {
    headers,
  });
  const ctx = createExecutionContext();
  const response = await app.fetch(
    request,
    {
      ...env,
      GYOKA_API_KEY: options.apiKeySetting,
    },
    ctx
  );
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

  it('allows ping without X-API-Key when GYOKA_API_KEY is not set', async () => {
    const { response, json } = await pingWithAuth({
      apiKeySetting: undefined,
    });

    expect(response.status).toBe(200);
    expect(json).toEqual({
      message: 'Gyoka is available',
    });
  });

  it('rejects ping when GYOKA_API_KEY is set and X-API-Key is missing', async () => {
    const { response, json } = await pingWithAuth({
      apiKeySetting: 'secret-key',
    });

    expect(response.status).toBe(401);
    expect(json).toEqual({
      error: 'Unauthorized',
      message: 'Authentication credentials were missing or invalid.',
    });
  });

  it('rejects ping when GYOKA_API_KEY is set and X-API-Key is invalid', async () => {
    const { response, json } = await pingWithAuth({
      apiKeySetting: 'secret-key',
      headerApiKey: 'wrong-key',
    });

    expect(response.status).toBe(401);
    expect(json).toEqual({
      error: 'Unauthorized',
      message: 'Authentication credentials were missing or invalid.',
    });
  });

  it('allows ping when GYOKA_API_KEY is set and X-API-Key matches', async () => {
    const { response, json } = await pingWithAuth({
      apiKeySetting: 'secret-key',
      headerApiKey: 'secret-key',
    });

    expect(response.status).toBe(200);
    expect(json).toEqual({
      message: 'Gyoka is available',
    });
  });
});
