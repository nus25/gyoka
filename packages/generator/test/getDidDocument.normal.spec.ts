import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import { requestDidDocument } from './getDidDocument.shared';

describe('Success cases', () => {
  it('Given valid configuration When requesting DID document Then it returns 200 with valid payload', async () => {
    const response = await requestDidDocument();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/did+ld+json');

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
