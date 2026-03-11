import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';

import {
  assertValidResponse,
  DEFAULT_FEED_URI,
  ENDPOINT_PATH,
  seedDefaultFeed,
  updateFeed,
} from './updateFeed.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await seedDefaultFeed();
  });

  describe('Boundary cases', () => {
    it('Given current values are false When updated to true Then both flags become true', async () => {
      const db = env.DB;
      await db
        .prepare('UPDATE feeds SET lang_filter = ?, is_active = ? WHERE feed_uri = ?')
        .bind(0, 0, DEFAULT_FEED_URI)
        .run();

      const request = {
        uri: DEFAULT_FEED_URI,
        langFilter: true,
        isActive: true,
      };

      const { response, json } = await updateFeed(request);
      assertValidResponse(response);
      expect(json).toEqual({
        message: 'Feed updated successfully',
        feed: {
          uri: DEFAULT_FEED_URI,
          langFilter: true,
          isActive: true,
        },
      });

      const { results } = await db
        .prepare('SELECT * FROM feeds WHERE feed_uri = ?')
        .bind(DEFAULT_FEED_URI)
        .all();
      expect(results.length).toBe(1);
      expect(results[0].feed_uri).toBe(DEFAULT_FEED_URI);
      expect(results[0].lang_filter).toBe(1);
      expect(results[0].is_active).toBe(1);
    });
  });
});
