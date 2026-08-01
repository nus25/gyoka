import { beforeEach, describe, expect, it } from 'vitest';

import {
  countPostsByUriInFeed,
  FEED_URI,
  insertFeed,
  insertPost,
  POST_URI,
} from './feedTest.shared';
import { ENDPOINT_PATH, removePost, resetFeedTables } from './removePost.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetFeedTables();
  });

  describe('Boundary cases', () => {
    it('Given indexedAt is provided When removePost is called Then exact post is removed', async () => {
      const indexedAt = '2025-01-01T00:00:00.000Z';
      const { feedId } = await insertFeed(FEED_URI);
      await insertPost(feedId, { uri: POST_URI, indexedAt });

      const { response, json } = await removePost({
        feed: FEED_URI,
        post: { uri: POST_URI, indexedAt },
      });

      expect(response.status).toBe(200);
      expect((json as { message: string }).message).toBe('Post removed successfully');
      expect(await countPostsByUriInFeed(FEED_URI, POST_URI)).toBe(0);
    });
  });
});
