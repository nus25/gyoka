import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { requestDidDocument } from './getDidDocument.shared';

describe('Error cases', () => {
  it('Given missing FEEDGEN_HOST When requesting DID document Then it returns 500', async () => {
    const response = await requestDidDocument({
      ...env,
      FEEDGEN_HOST: undefined,
    } as unknown as typeof env);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'InternalServerError',
      message: 'Missing required environment variables',
    });
  });

  it('Given missing DB configuration When requesting DID document Then it returns 500', async () => {
    const response = await requestDidDocument({
      ...env,
      DB: undefined,
    } as unknown as typeof env);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'InternalServerError',
      message: 'Missing database configuration',
    });
  });
});
