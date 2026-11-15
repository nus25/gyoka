import { beforeEach, describe, expect, it } from 'vitest';

import { FEED_URI, resetFeedTables, callProcedure } from './feedTest.shared';
import { TRIM_PATH } from './postMutation.shared';

describe('trimPosts', () => {
  beforeEach(resetFeedTables);

  it('Given an unknown feed, when trimming, then returns unknown feed', async () => {
    const { response, json } = await callProcedure(TRIM_PATH, {
      feed: FEED_URI,
      remain: 0,
    });

    expect(response.status).toBe(404);
    expect(json).toEqual({
      error: 'UnknownFeed',
      message: `Feed with URI ${FEED_URI} does not exist.`,
    });
  });

  it('Given post selection reports failure, when trimming, then returns internal server error', async () => {
    const failingDb = {
      prepare: () => ({
        bind: () => ({
          first: async () => ({
            feed_id: 1,
            order_revision: 0,
          }),
          all: async () => ({ success: false, results: [] }),
          run: async () => ({ meta: { changes: 1 } }),
        }),
      }),
    } as unknown as D1Database;

    const { response, json } = await callProcedure(
      TRIM_PATH,
      { feed: FEED_URI, remain: 0 },
      { DB: failingDb }
    );

    expect(response.status).toBe(500);
    expect(json).toEqual({
      error: 'InternalServerError',
      message: 'Failed to select posts to trim.',
    });
  });
});
