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

  describe('Success cases', () => {
    it('Given post exists When removePost is called Then post is removed', async () => {
      const { feedId } = await insertFeed(FEED_URI);
      await insertPost(feedId, { uri: POST_URI });

      const { response, json } = await removePost({
        feed: FEED_URI,
        post: { uri: POST_URI },
      });

      expect(response.status).toBe(200);
      expect((json as { message: string }).message).toBe('Post removed successfully');
      expect(await countPostsByUriInFeed(FEED_URI, POST_URI)).toBe(0);
    });
  });
});
