import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';

import app from '../src/index';
import { TEST_API_KEY } from './testUtils';

export const BASE_URL = 'http://localhost:8787';
export const ENDPOINT_PATH = '/api/gyoka/ping';

export async function ping() {
  const request = new Request(`${BASE_URL}${ENDPOINT_PATH}`, {
    headers: {
      'X-API-Key': TEST_API_KEY,
    },
  });
  const ctx = createExecutionContext();
  const response = await app.fetch(
    request,
    {
      ...env,
      GYOKA_API_KEY: TEST_API_KEY,
    },
    ctx
  );
  await waitOnExecutionContext(ctx);
  return {
    response,
    json: await response.json(),
  };
}

export async function pingWithAuth(options: {
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
