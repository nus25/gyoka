import { beforeEach, describe, expect, it } from 'vitest';

import { countPostsByUriInFeed, FEED_URI, POST_URI } from './feedTest.shared';
import { ENDPOINT_PATH, removePost, resetFeedTables } from './removePost.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetFeedTables();
  });

  describe('Error cases', () => {
    it('Given feed does not exist When removePost is called Then not found is returned', async () => {
      const { response, json } = await removePost({
        feed: FEED_URI,
        post: { uri: POST_URI },
      });

      expect(response.status).toBe(404);
      expect((json as { error: string }).error).toBe('NotFound');
      expect(await countPostsByUriInFeed(FEED_URI, POST_URI)).toBe(0);
    });
  });
});
