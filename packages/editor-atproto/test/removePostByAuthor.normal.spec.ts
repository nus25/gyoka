import { beforeEach, describe, expect, it } from 'vitest';

import {
  AUTHOR_DID,
  countPostsByFeedUri,
  FEED_URI,
  insertFeed,
  insertPost,
} from './feedTest.shared';
import { ENDPOINT_PATH, removePostByAuthor, resetFeedTables } from './removePostByAuthor.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetFeedTables();
  });

  describe('Success cases', () => {
    it('Given author has posts in feed When removePostByAuthor is called Then posts are removed', async () => {
      const { feedId } = await insertFeed(FEED_URI);
      await insertPost(feedId, { uri: `at://${AUTHOR_DID}/app.bsky.feed.post/p1` });

      const { response, json } = await removePostByAuthor({ feed: FEED_URI, author: AUTHOR_DID });

      expect(response.status).toBe(200);
      expect(json).toEqual({
        message: 'Posts by author removed successfully',
        feed: FEED_URI,
        author: AUTHOR_DID,
        deletedCount: 1,
      });

      expect(await countPostsByFeedUri(FEED_URI)).toBe(0);
    });
  });
});
