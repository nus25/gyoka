import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';

import {
  assertValidResponse,
  DEFAULT_FEED_URI,
  ENDPOINT_PATH,
  seedDefaultFeed,
  unregisterFeed,
} from './unregisterFeed.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await seedDefaultFeed();
  });

  describe('Boundary cases', () => {
    it('Given feed has zero associated posts When unregister feed is called Then operation succeeds and no posts remain', async () => {
      const { response, json } = await unregisterFeed(DEFAULT_FEED_URI);
      assertValidResponse(response);
      expect(json).toEqual({
        message: 'Feed unregistered successfully',
      });

      const db = env.DB;
      const { results: posts } = await db.prepare('SELECT * FROM posts').all();
      expect(posts.length).toBe(0);
    });
  });
});
