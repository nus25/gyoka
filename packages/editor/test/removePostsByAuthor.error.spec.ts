import { beforeEach, describe, expect, it } from 'vitest';

import { AUTHOR_DID, FEED_URI, resetFeedTables, callProcedure } from './feedTest.shared';
import { REMOVE_BY_AUTHOR_PATH } from './postMutation.shared';

describe('removePostsByAuthor', () => {
  beforeEach(resetFeedTables);

  it('Given an unknown feed When removing posts by author Then returns unknown feed', async () => {
    const { response, json } = await callProcedure(REMOVE_BY_AUTHOR_PATH, {
      feed: FEED_URI,
      author: AUTHOR_DID,
    });

    expect(response.status).toBe(404);
    expect(json).toEqual({
      error: 'UnknownFeed',
      message: `Feed with URI ${FEED_URI} does not exist.`,
    });
  });

  it('Given post selection reports failure When removing posts by author Then returns internal server error', async () => {
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
      REMOVE_BY_AUTHOR_PATH,
      { feed: FEED_URI, author: AUTHOR_DID },
      { DB: failingDb }
    );

    expect(response.status).toBe(500);
    expect(json).toEqual({
      error: 'InternalServerError',
      message: 'Failed to select posts by author.',
    });
  });
});
