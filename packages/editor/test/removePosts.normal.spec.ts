import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_CID, FEED_URI, insertFeed, resetFeedTables, callProcedure } from './feedTest.shared';
import {
  findOrderRevision,
  POST_ONE,
  POST_TWO,
  PUT_PATH,
  REMOVE_PATH,
} from './postMutation.shared';

describe('removePosts', () => {
  beforeEach(resetFeedTables);

  it('Given a missing post and developer mode enabled When removing it Then debug logs include the deletion result', async () => {
    await insertFeed(FEED_URI);
    const output = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const { response } = await callProcedure(
        REMOVE_PATH,
        { feed: FEED_URI, uris: [POST_ONE] },
        { DEVELOPER_MODE: 'enabled' }
      );
      expect(response.status).toBe(200);
      const records = output.mock.calls.map(([line]) => JSON.parse(String(line)));
      expect(records).toContainEqual(
        expect.objectContaining({
          level: 'debug',
          event: 'feed.remove.posts.success',
          postCount: 1,
          deletedCount: 0,
          orderRevision: 0,
        })
      );
      expect(JSON.stringify(records)).not.toContain(POST_ONE);
    } finally {
      output.mockRestore();
    }
  });

  it('Given found and missing posts, when removing them, then removes found posts and advances the revision once', async () => {
    await insertFeed(FEED_URI);
    await callProcedure(PUT_PATH, { feed: FEED_URI, posts: [{ uri: POST_ONE, cid: TEST_CID }] });

    const { response, json } = await callProcedure(REMOVE_PATH, {
      feed: FEED_URI,
      uris: [POST_ONE, POST_TWO],
    });

    expect(response.status).toBe(200);
    expect(json).toEqual({ feed: FEED_URI, deletedCount: 1, orderRevision: 2 });
  });

  it('Given no matching posts, when removing them, then succeeds without advancing the revision', async () => {
    await insertFeed(FEED_URI);

    const { response, json } = await callProcedure(REMOVE_PATH, {
      feed: FEED_URI,
      uris: [POST_ONE],
    });

    expect(response.status).toBe(200);
    expect(json).toEqual({ feed: FEED_URI, deletedCount: 0, orderRevision: 0 });
  });

  it('Given a feed with a post, when removing the post, then advances the revision once', async () => {
    const { feedId } = await insertFeed(FEED_URI);
    await callProcedure(PUT_PATH, { feed: FEED_URI, posts: [{ uri: POST_ONE, cid: TEST_CID }] });

    const { response, json } = await callProcedure(REMOVE_PATH, {
      feed: FEED_URI,
      uris: [POST_ONE],
    });

    expect(response.status).toBe(200);
    expect(json).toEqual({ feed: FEED_URI, deletedCount: 1, orderRevision: 2 });
    await expect(findOrderRevision(feedId)).resolves.toBe(2);
  });
});
