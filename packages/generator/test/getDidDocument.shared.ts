import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';

import app from '../src/index';

export const BASE_URL = 'http://localhost:8787';
export const DID_ENDPOINT_PATH = '/.well-known/did.json';

export async function requestDidDocument(requestEnv = env, method = 'GET') {
  const request = new Request(`${BASE_URL}${DID_ENDPOINT_PATH}`, { method });
  const ctx = createExecutionContext();
  const response = await app.fetch(request, requestEnv, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}
