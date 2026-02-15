import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';

import app from '../src/index';

export const BASE_URL = 'http://localhost:8787';

export async function requestPath(path: string, requestEnv = env) {
  const request = new Request(`${BASE_URL}${path}`);
  const ctx = createExecutionContext();
  const response = await app.fetch(request, requestEnv, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}
