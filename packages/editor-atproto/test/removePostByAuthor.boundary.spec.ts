import { beforeEach, describe, expect, it } from 'vitest';

import { AUTHOR_DID, countPostsByFeedUri, FEED_URI, insertFeed } from './feedTest.shared';
import { ENDPOINT_PATH, removePostByAuthor, resetFeedTables } from './removePostByAuthor.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetFeedTables();
  });

  describe('Boundary cases', () => {
    it('Given author has no posts in feed When removePostByAuthor is called Then deleted count is zero', async () => {
      await insertFeed(FEED_URI);

      const { response, json } = await removePostByAuthor({ feed: FEED_URI, author: AUTHOR_DID });

      expect(response.status).toBe(200);
      expect(json).toEqual({
        message: 'Posts by author removed successfully',
        feed: FEED_URI,
        author: AUTHOR_DID,
        deletedCount: 0,
      });

      expect(await countPostsByFeedUri(FEED_URI)).toBe(0);
    });
  });
});
