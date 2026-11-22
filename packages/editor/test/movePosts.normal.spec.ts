import { beforeEach, describe, expect, it } from 'vitest';

import { TEST_CID, FEED_URI, insertFeed, resetFeedTables, callProcedure } from './feedTest.shared';
import { MOVE_PATH, orderedUris, POST_ONE, POST_TWO, PUT_PATH } from './postMutation.shared';

describe('movePosts', () => {
  beforeEach(resetFeedTables);

  it('Given a move input order, when moving posts, then preserves the input order rather than the current rank order', async () => {
    const { feedId } = await insertFeed(FEED_URI);
    await callProcedure(PUT_PATH, {
      feed: FEED_URI,
      posts: [
        { uri: POST_ONE, cid: TEST_CID },
        { uri: POST_TWO, cid: TEST_CID },
        { uri: 'at://did:plc:author/app.bsky.feed.post/three', cid: TEST_CID },
      ],
    });

    const { response } = await callProcedure(MOVE_PATH, {
      feed: FEED_URI,
      posts: [POST_TWO, POST_ONE],
      placement: { position: 'append' },
      expectedRevision: 1,
    });

    expect(response.status).toBe(200);
    await expect(orderedUris(feedId)).resolves.toEqual([
      'at://did:plc:author/app.bsky.feed.post/three',
      POST_TWO,
      POST_ONE,
    ]);
  });

  it('Given a post and an expected revision, when moving the post, then moves it atomically', async () => {
    await insertFeed(FEED_URI);
    await callProcedure(PUT_PATH, {
      feed: FEED_URI,
      posts: [
        { uri: POST_ONE, cid: TEST_CID },
        { uri: POST_TWO, cid: TEST_CID },
      ],
    });

    const { response, json } = await callProcedure(MOVE_PATH, {
      feed: FEED_URI,
      posts: [POST_TWO],
      placement: { position: 'prepend' },
      expectedRevision: 1,
    });

    expect(response.status).toBe(200);
    expect(json).toMatchObject({ feed: FEED_URI, orderRevision: 2, movedCount: 1 });
  });
});
