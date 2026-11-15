import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FEED_URI, findFeedRowByUri, insertFeed } from './feedTest.shared';
import { ENDPOINT_PATH, resetFeedTables, updateFeed } from './updateFeed.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetFeedTables();
  });

  describe('Success cases', () => {
    it('Given an existing feed When updating settings in developer mode Then the debug summary includes updated values', async () => {
      await insertFeed(FEED_URI, 1, 1, 4);
      const output = vi.spyOn(console, 'log').mockImplementation(() => {});
      try {
        const { response } = await updateFeed(
          { uri: FEED_URI, isActive: false },
          { DEVELOPER_MODE: 'enabled' }
        );
        expect(response.status).toBe(200);
        expect(output.mock.calls.map(([line]) => JSON.parse(String(line)))).toContainEqual(
          expect.objectContaining({
            event: 'feed.update.feed.success',
            feed: FEED_URI,
            isActive: false,
            orderRevision: 4,
          })
        );
      } finally {
        output.mockRestore();
      }
    });

    it('Given existing feed When update isActive Then updated feed is returned', async () => {
      await insertFeed(FEED_URI, 1, 1, 4);

      const { response, json } = await updateFeed({
        uri: FEED_URI,
        isActive: false,
      });

      expect(response.status).toBe(200);
      expect(json).toEqual({
        message: 'Feed updated successfully',
        feed: {
          uri: FEED_URI,
          langFilter: true,
          isActive: false,
          orderRevision: 4,
        },
      });

      const row = await findFeedRowByUri(FEED_URI);
      expect(row).toEqual({
        feed_uri: FEED_URI,
        lang_filter: 1,
        is_active: 0,
        order_revision: 4,
      });
    });
  });
});
