import { beforeEach, describe, expect, it } from 'vitest';

import { countPostsByFeedUri, FEED_URI, insertFeed, insertPost, POST_URI } from './feedTest.shared';
import { ENDPOINT_PATH, resetFeedTables, trimFeed } from './trimFeed.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetFeedTables();
  });

  describe('Boundary cases', () => {
    it('Given remain is larger than existing posts When trimFeed is called Then deleted count is zero', async () => {
      const { feedId } = await insertFeed(FEED_URI);
      await insertPost(feedId, { uri: POST_URI });

      const { response, json } = await trimFeed({ feed: FEED_URI, remain: 10 });

      expect(response.status).toBe(200);
      expect(json).toEqual({
        message: 'Posts trimed successfully',
        feed: FEED_URI,
        deletedCount: 0,
      });

      expect(await countPostsByFeedUri(FEED_URI)).toBe(1);
    });
  });
});
