import { beforeEach, describe, expect, it } from 'vitest';

import { countPostsByFeedUri, FEED_URI } from './feedTest.shared';
import { ENDPOINT_PATH, resetFeedTables, trimFeed } from './trimFeed.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetFeedTables();
  });

  describe('Error cases', () => {
    it('Given feed does not exist When trimFeed is called Then unknown feed is returned', async () => {
      const { response, json } = await trimFeed({ feed: FEED_URI, remain: 1 });

      expect(response.status).toBe(404);
      expect(json).toEqual({
        error: 'UnknownFeed',
        message: `Feed with URI ${FEED_URI} does not exist.`,
      });

      expect(await countPostsByFeedUri(FEED_URI)).toBe(0);
    });
  });
});
