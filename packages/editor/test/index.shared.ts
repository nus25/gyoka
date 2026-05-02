import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';

import app from '../src/index';
import { TEST_API_KEY } from './testUtils';

export const BASE_URL = 'http://localhost:8787';

export async function fetchPath(path: string, customEnv: Partial<typeof env> = {}) {
  const request = new Request(`${BASE_URL}${path}`, {
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
      ...customEnv,
    } as typeof env,
    ctx
  );
  await waitOnExecutionContext(ctx);
  return response;
}
