import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import { requestPath } from './index.shared';

const DESCRIBE_ENDPOINT = '/xrpc/app.bsky.feed.describeFeedGenerator';

describe('Error cases', () => {
  it('Given missing required env variables When describing generator Then it returns 500 internal server error', async () => {
    const noHostResponse = await requestPath(DESCRIBE_ENDPOINT, {
      FEEDGEN_PUBLISHER_DID: env.FEEDGEN_PUBLISHER_DID,
      FEEDGEN_HOST: undefined,
      DB: env.DB,
    } as unknown as typeof env);

    expect(noHostResponse.status).toBe(500);
    expect(await noHostResponse.json()).toEqual({
      error: 'InternalServerError',
      message: 'Missing required environment variables',
    });

    const noDidResponse = await requestPath(DESCRIBE_ENDPOINT, {
      FEEDGEN_PUBLISHER_DID: undefined,
      FEEDGEN_HOST: env.FEEDGEN_HOST,
      DB: env.DB,
    } as unknown as typeof env);

    expect(noDidResponse.status).toBe(500);
    expect(await noDidResponse.json()).toEqual({
      error: 'InternalServerError',
      message: 'Missing required environment variables',
    });
  });

  it('Given missing DB config When describing generator Then it returns 500 internal server error', async () => {
    const response = await requestPath(DESCRIBE_ENDPOINT, {
      FEEDGEN_PUBLISHER_DID: env.FEEDGEN_PUBLISHER_DID,
      FEEDGEN_HOST: env.FEEDGEN_HOST,
      DB: undefined,
    } as unknown as typeof env);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'InternalServerError',
      message: 'Missing database configuration',
    });
  });

  it('Given invalid publisher DID format When describing generator Then it returns 500 internal server error', async () => {
    const response = await requestPath(DESCRIBE_ENDPOINT, {
      FEEDGEN_PUBLISHER_DID: 'not-a-did',
      FEEDGEN_HOST: env.FEEDGEN_HOST,
      DB: env.DB,
    } as unknown as typeof env);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'InternalServerError',
      message: 'Invalid required environment variables',
    });
  });

  it('Given invalid host format When describing generator Then it returns 500 internal server error', async () => {
    const response = await requestPath(DESCRIBE_ENDPOINT, {
      FEEDGEN_PUBLISHER_DID: env.FEEDGEN_PUBLISHER_DID,
      FEEDGEN_HOST: 'invalid_host',
      DB: env.DB,
    } as unknown as typeof env);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'InternalServerError',
      message: 'Invalid required environment variables',
    });
  });

  it('Given unexpected non-Gyoka error When describing generator Then it returns 500 internal server error', async () => {
    const response = await requestPath(DESCRIBE_ENDPOINT, {
      FEEDGEN_PUBLISHER_DID: env.FEEDGEN_PUBLISHER_DID,
      FEEDGEN_HOST: env.FEEDGEN_HOST,
      DB: {
        prepare: () => {
          throw new Error('unexpected db error');
        },
      },
    } as unknown as typeof env);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'InternalServerError',
      message: 'An unexpected error occurred.',
    });
  });
});
