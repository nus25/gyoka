import { beforeEach, describe, expect, it } from 'vitest';

import { FEED_URI, insertFeed, insertPost, POST_URI, POST_URI_2 } from './feedTest.shared';
import { ENDPOINT_PATH, getPosts, resetFeedTables } from './getPosts.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetFeedTables();
  });

  describe('Boundary cases', () => {
    it('Given limit equals one When feed has multiple posts Then cursor is returned', async () => {
      const { feedId } = await insertFeed(FEED_URI);
      await insertPost(feedId, { uri: POST_URI, indexedAt: '2025-01-01T00:00:00.000Z' });
      await insertPost(feedId, { uri: POST_URI_2, indexedAt: '2025-01-02T00:00:00.000Z' });

      const { response, json } = await getPosts({ feed: FEED_URI, limit: 1 });

      expect(response.status).toBe(200);
      expect(typeof (json as { cursor?: string }).cursor).toBe('string');
      expect((json as { posts: unknown[] }).posts.length).toBe(1);
    });
  });
});
