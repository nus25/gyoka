import { beforeEach, describe, expect, it } from 'vitest';

import { FEED_URI, insertFeed, resetFeedTables, callProcedure } from './feedTest.shared';
import { POST_ONE, REMOVE_PATH } from './postMutation.shared';

describe('removePosts', () => {
  beforeEach(resetFeedTables);

  it('Given duplicate post URIs, when removing posts, then returns bad request', async () => {
    await insertFeed(FEED_URI);

    const { response, json } = await callProcedure(REMOVE_PATH, {
      feed: FEED_URI,
      uris: [POST_ONE, POST_ONE],
      expectedRevision: 0,
    });

    expect(response.status).toBe(400);
    expect(json).toEqual({
      error: 'BadRequest',
      message: 'posts must contain between 1 and 1000 unique URIs.',
    });
  });

  it('Given an unknown feed, when removing posts, then returns unknown feed', async () => {
    const { response, json } = await callProcedure(REMOVE_PATH, {
      feed: FEED_URI,
      uris: [POST_ONE],
    });

    expect(response.status).toBe(404);
    expect(json).toEqual({
      error: 'UnknownFeed',
      message: `Feed with URI ${FEED_URI} does not exist.`,
    });
  });

  it('Given a URI from the wrong collection, when removing posts, then returns bad request', async () => {
    await insertFeed(FEED_URI);

    const { response, json } = await callProcedure(REMOVE_PATH, {
      feed: FEED_URI,
      uris: [FEED_URI],
    });

    expect(response.status).toBe(400);
    expect(json).toEqual({ error: 'BadRequest', message: 'Invalid post URI collection' });
  });
});
