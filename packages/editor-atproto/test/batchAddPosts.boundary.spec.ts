import { beforeEach, describe, expect, it } from 'vitest';

import { batchAddPosts, ENDPOINT_PATH, resetFeedTables } from './batchAddPosts.shared';
import { countPostsByFeedUri, FEED_URI, insertFeed } from './feedTest.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetFeedTables();
  });

  describe('Boundary cases', () => {
    it('Given one invalid post in batch When batchAddPosts is called Then only that post gets error result', async () => {
      await insertFeed(FEED_URI);

      const entries = [
        {
          feed: FEED_URI,
          posts: [
            {
              uri: 'at://did:plc:testuser/app.bsky.feed.generator/invalid-post',
              cid: 'bafyreia3tbsfxe3cc6qxibc2pj4tcmxqyxupz3hajxuepz4g5qkdqxnx6y',
            },
          ],
        },
      ];

      const { response, json } = await batchAddPosts({ entries });

      expect(response.status).toBe(200);
      expect(
        (json as { results: Array<{ results: Array<{ status: string; error?: string }> }> })
          .results[0].results[0]
      ).toEqual({
        uri: entries[0].posts[0].uri,
        status: 'error',
        error: 'Invalid post URI collection',
      });

      expect(await countPostsByFeedUri(FEED_URI)).toBe(0);
    });
  });
});
