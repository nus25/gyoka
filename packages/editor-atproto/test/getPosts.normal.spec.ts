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
      await insertPost(feedId, { uri: POST_URI, languages: ['en'] });

      const { response, json } = await getPosts({ feed: FEED_URI });

      expect(response.status).toBe(200);
      expect((json as { feed: string }).feed).toBe(FEED_URI);
      expect((json as { posts: unknown[] }).posts.length).toBe(1);
    });
  });
});
