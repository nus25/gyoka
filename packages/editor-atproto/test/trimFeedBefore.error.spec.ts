import { beforeEach, describe, expect, it } from 'vitest';

import { countPostsByFeedUri, FEED_URI } from './feedTest.shared';
import { ENDPOINT_PATH, resetFeedTables, trimFeedBefore } from './trimFeedBefore.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetFeedTables();
  });

  describe('Error cases', () => {
    it('Given feed does not exist When trimFeedBefore is called Then unknown feed is returned', async () => {
      const { response, json } = await trimFeedBefore({
        feed: FEED_URI,
        before: '2025-01-02T00:00:00.000Z',
      });

      expect(response.status).toBe(404);
      expect(json).toEqual({
        error: 'UnknownFeed',
        message: `Feed with URI ${FEED_URI} does not exist.`,
      });

      expect(await countPostsByFeedUri(FEED_URI)).toBe(0);
    });
  });
});