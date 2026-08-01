import { beforeEach, describe, expect, it } from 'vitest';

import { batchRemovePosts, ENDPOINT_PATH, resetFeedTables } from './batchRemovePosts.shared';
import { countPostsByFeedUri, FEED_URI, insertFeed, POST_URI } from './feedTest.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetFeedTables();
  });

  describe('Boundary cases', () => {
    it('Given post does not exist in feed When batchRemovePosts is called Then per-post error is returned', async () => {
      await insertFeed(FEED_URI);

      const entries = [
        {
          feed: FEED_URI,
          posts: [{ uri: POST_URI }],
        },
      ];

      const { response, json } = await batchRemovePosts({ entries });

      expect(response.status).toBe(200);
      expect(
        (json as { results: Array<{ results: Array<{ status: string; error?: string }> }> })
          .results[0].results[0]
      ).toEqual({
        uri: POST_URI,
        status: 'error',
        error: 'Post not found in feed',
      });

      expect(await countPostsByFeedUri(FEED_URI)).toBe(0);
    });
  });
});
