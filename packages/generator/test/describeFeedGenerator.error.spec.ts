import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  requestDescribeFeedGeneratorJson,
  resetDescribeFeedGeneratorTables,
} from './describeFeedGenerator.shared';

describe('Error cases', () => {
  beforeEach(async () => {
    await resetDescribeFeedGeneratorTables();
  });

  it('Given feed query failure When describing generator Then it returns 500 internal server error', async () => {
    const { response, json } = await requestDescribeFeedGeneratorJson({
      ...env,
      DB: {
        prepare: () => ({
          all: async () => ({ success: false, results: [] }),
        }),
      },
    } as unknown as typeof env);

    expect(response.status).toBe(500);
    expect(json).toEqual({
      error: 'InternalServerError',
      message: 'Failed to fetch feeds',
    });
  });

  it('Given document query failure When describing generator Then it returns 500 internal server error', async () => {
    let callCount = 0;
    const { response, json } = await requestDescribeFeedGeneratorJson({
      ...env,
      DB: {
        prepare: () => ({
          all: async () => {
            callCount += 1;
            if (callCount === 1) {
              return { success: true, results: [] };
            }
            return { success: false, results: [] };
          },
        }),
      },
    } as unknown as typeof env);

    expect(response.status).toBe(500);
    expect(json).toEqual({
      error: 'InternalServerError',
      message: 'Failed to fetch links',
    });
  });
});
