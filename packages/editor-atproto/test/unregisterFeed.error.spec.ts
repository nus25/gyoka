import { beforeEach, describe, expect, it } from 'vitest';

import { countFeedRowsByUri, FEED_URI } from './feedTest.shared';
import { ENDPOINT_PATH, resetFeedTables, unregisterFeed } from './unregisterFeed.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetFeedTables();
  });

  describe('Error cases', () => {
    it('Given feed does not exist When unregisterFeed is called Then unknown feed is returned', async () => {
      const { response, json } = await unregisterFeed({ uri: FEED_URI });

      expect(response.status).toBe(404);
      expect(json).toEqual({
        error: 'UnknownFeed',
        message: `Feed with URI ${FEED_URI} does not exist.`,
      });

      expect(await countFeedRowsByUri(FEED_URI)).toBe(0);
    });
  });
});
