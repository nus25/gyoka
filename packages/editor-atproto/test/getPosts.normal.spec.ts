import { beforeEach, describe, expect, it } from 'vitest';

import { FEED_URI, insertFeed, insertPost, POST_URI } from './feedTest.shared';
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
  });
});
