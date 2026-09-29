import { beforeEach, describe, expect, it } from 'vitest';

import { CID, FEED_URI, insertFeed, insertPost, POST_URI, POST_URI_2 } from './feedTest.shared';
import { ENDPOINT_PATH, getPosts, resetFeedTables } from './getPosts.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetFeedTables();
  });

  describe('Success cases', () => {
    it('Given feed has posts When getPosts is called Then posts are returned', async () => {
      const { feedId } = await insertFeed(FEED_URI);
      await insertPost(feedId, {
        uri: POST_URI,
        languages: ['en'],
        reason: {
          $type: 'net.nusno.gyoka.feed.defs#skeletonReasonRepost',
          repost: 'at://did:plc:testuser/app.bsky.feed.repost/post1',
        },
      });

      const { response, json } = await getPosts({ feed: FEED_URI });
      console.log(json);
      expect(response.status).toBe(200);
      expect((json as { feed: string }).feed).toBe(FEED_URI);
      expect((json as { posts: unknown[] }).posts.length).toBe(1);
      expect(
        (json as { posts: { reason?: { $type: string; repost?: string } }[] }).posts[0].reason
      ).toEqual({
        $type: 'net.nusno.gyoka.feed.defs#skeletonReasonRepost',
        repost: 'at://did:plc:testuser/app.bsky.feed.repost/post1',
      });
    });

    it('Given post filters When getPosts is called Then only posts matching every filter are returned', async () => {
      const { feedId } = await insertFeed(FEED_URI);
      await insertPost(feedId, {
        uri: POST_URI,
        cid: CID,
        indexedAt: '2025-01-01T00:00:00.000Z',
      });
      await insertPost(feedId, {
        uri: POST_URI_2,
        cid: CID,
        indexedAt: '2025-01-02T00:00:00.000Z',
      });

      const { response, json } = await getPosts({
        feed: FEED_URI,
        uri: POST_URI,
        cid: CID,
        indexedAt: '2025-01-01T00:00:00Z',
      });

      expect(response.status).toBe(200);
      expect((json as { posts: { uri: string }[] }).posts).toHaveLength(1);
      expect((json as { posts: { uri: string }[] }).posts[0].uri).toBe(POST_URI);
    });

    it('Given an opaque cursor When getPosts is called without filters Then its search conditions are continued', async () => {
      const { feedId } = await insertFeed(FEED_URI);
      await insertPost(feedId, { uri: POST_URI, indexedAt: '2025-01-01T00:00:00.000Z' });
      await insertPost(feedId, { uri: POST_URI_2, indexedAt: '2025-01-02T00:00:00.000Z' });

      const firstPage = await getPosts({ feed: FEED_URI, uri: POST_URI, limit: 1 });
      const cursor = (firstPage.json as { cursor?: string }).cursor;
      const secondPage = await getPosts({ cursor });

      expect(firstPage.response.status).toBe(200);
      expect(cursor).toEqual(expect.any(String));
      expect(secondPage.response.status).toBe(200);
      expect((secondPage.json as { feed: string }).feed).toBe(FEED_URI);
      expect((secondPage.json as { posts: unknown[] }).posts).toEqual([]);
    });
  });
});
