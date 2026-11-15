import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { requestDidDocument } from './getDidDocument.shared';

describe('Boundary cases', () => {
  it('Given non-GET method When requesting DID endpoint Then it returns 404', async () => {
    const response = await requestDidDocument(env, 'POST');

    expect(response.status).toBe(404);
  });

  it('Given host with nested subdomain When requesting DID document Then host is reflected in id and endpoint', async () => {
    const customHost = 'sub.feed-generator.example.com';
    const response = await requestDidDocument({
      ...env,
      FEEDGEN_HOST: customHost,
    } as typeof env);

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      id: string;
      service: Array<{ serviceEndpoint: string }>;
    };
    expect(json.id).toBe(`did:web:${customHost}`);
    expect(json.service[0].serviceEndpoint).toBe(`https://${customHost}`);
  });
});
