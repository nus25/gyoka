import { beforeEach, describe, expect, it } from 'vitest';

import { countFeedRowsByUri, countPostsByFeedUri, FEED_URI, insertFeed } from './feedTest.shared';
import { ENDPOINT_PATH, resetFeedTables, unregisterFeed } from './unregisterFeed.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetFeedTables();
  });

  describe('Success cases', () => {
    it('Given existing feed When unregisterFeed is called Then feed is removed', async () => {
      await insertFeed(FEED_URI, 1, 1);

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
