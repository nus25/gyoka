import { beforeEach, describe, expect, it } from 'vitest';

import {
  countFeedRowsByUri,
  countPostsByFeedUri,
  FEED_URI,
  insertFeed,
  insertPost,
  POST_URI,
} from './feedTest.shared';
import { ENDPOINT_PATH, resetFeedTables, unregisterFeed } from './unregisterFeed.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetFeedTables();
  });

  describe('Boundary cases', () => {
    it('Given feed has posts When unregisterFeed is called Then associated data is removed', async () => {
      const { feedId } = await insertFeed(FEED_URI, 1, 1);
      await insertPost(feedId, { uri: POST_URI });

      const { response, json } = await unregisterFeed({ uri: FEED_URI });

      expect(response.status).toBe(200);
      expect(json).toEqual({
        message: 'Feed unregistered successfully',
      });

      expect(await countFeedRowsByUri(FEED_URI)).toBe(0);
      expect(await countPostsByFeedUri(FEED_URI)).toBe(0);
    });
  });
});
