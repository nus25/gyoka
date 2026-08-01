import { beforeEach, describe, expect, it } from 'vitest';

import { AUTHOR_DID, countPostsByFeedUri, FEED_URI } from './feedTest.shared';
import { ENDPOINT_PATH, removePostByAuthor, resetFeedTables } from './removePostByAuthor.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetFeedTables();
  });

  describe('Error cases', () => {
    it('Given feed does not exist When removePostByAuthor is called Then unknown feed is returned', async () => {
      const { response, json } = await removePostByAuthor({ feed: FEED_URI, author: AUTHOR_DID });

      expect(response.status).toBe(404);
      expect(json).toEqual({
        error: 'UnknownFeed',
        message: `Feed with URI ${FEED_URI} does not exist.`,
      });

      expect(await countPostsByFeedUri(FEED_URI)).toBe(0);
    });
  });
});
