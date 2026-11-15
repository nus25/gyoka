import { beforeEach, describe, expect, it } from 'vitest';

import { FEED_URI, resetFeedTables, callProcedure } from './feedTest.shared';
import { PRUNE_BEFORE_PATH } from './postMutation.shared';

describe('prunePostsBefore', () => {
  beforeEach(resetFeedTables);

  it('Given an invalid before timestamp, when pruning, then returns bad request', async () => {
    const { response, json } = await callProcedure(PRUNE_BEFORE_PATH, {
      feed: FEED_URI,
      before: '2026-11-01T00:00:99.000Z',
    });

    expect(response.status).toBe(400);
    expect(json).toMatchObject({ error: 'BadRequest' });
    console.log(response, json);
  });

  it('Given an unknown feed, when pruning, then returns unknown feed', async () => {
    const { response, json } = await callProcedure(PRUNE_BEFORE_PATH, {
      feed: FEED_URI,
      before: '2026-01-01T00:00:00.000Z',
    });

    expect(response.status).toBe(404);
    expect(json).toEqual({
      error: 'UnknownFeed',
      message: `Feed with URI ${FEED_URI} does not exist.`,
    });
  });

  it('Given post selection reports failure, when pruning, then returns internal server error', async () => {
    const failingDb = {
      prepare: () => ({
        bind: () => ({
          first: async () => ({
            feed_id: 1,
            order_revision: 0,
          }),
          all: async () => ({ success: false, results: [] }),
        }),
      }),
    } as unknown as D1Database;

    const { response, json } = await callProcedure(
      PRUNE_BEFORE_PATH,
      { feed: FEED_URI, before: '2026-01-01T00:00:00.000Z' },
      { DB: failingDb }
    );

    expect(response.status).toBe(500);
    expect(json).toEqual({
      error: 'InternalServerError',
      message: 'Failed to select posts to prune.',
    });
  });
});
