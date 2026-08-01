import { beforeEach, describe, expect, it } from 'vitest';

import { FEED_URI, findFeedRowByUri, insertFeed } from './feedTest.shared';
import { ENDPOINT_PATH, resetFeedTables, updateFeed } from './updateFeed.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetFeedTables();
  });

  describe('Boundary cases', () => {
    it('Given existing feed When only langFilter is updated Then update succeeds', async () => {
      await insertFeed(FEED_URI, 1, 1);

      const { response, json } = await updateFeed({
        uri: FEED_URI,
        langFilter: false,
      });

      expect(response.status).toBe(200);
      expect(json).toEqual({
        message: 'Feed updated successfully',
        feed: {
          uri: FEED_URI,
          langFilter: false,
          isActive: true,
        },
      });

      const row = await findFeedRowByUri(FEED_URI);
      expect(row).toEqual({
        feed_uri: FEED_URI,
        lang_filter: 0,
        is_active: 1,
      });
    });
  });
});
