import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import app from '../src/index';

const BASE_URL = 'http://localhost:8787';
const ENDPOINT_PATH = '/.well-known/did.json';

describe('GET /.well-known/did.json', () => {
  it('returns 200 and a valid DID document', async () => {
    const request = new Request(`${BASE_URL}${ENDPOINT_PATH}`);
    const ctx = createExecutionContext();
    const response = await app.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/did+json');
    const json = await response.json();
    expect(json).toEqual({
      '@context': ['https://www.w3.org/ns/did/v1'],
      id: `did:web:${env.FEEDGEN_HOST}`,
      service: [
        {
          id: '#bsky_fg',
          type: 'BskyFeedGenerator',
          serviceEndpoint: `https://${env.FEEDGEN_HOST}`,
        },
      ],
    });
  });
});
