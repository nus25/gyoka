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

  describe('Success cases', () => {
    it('Given feed exists When unregister feed is called Then feed is removed', async () => {
      const { response, json } = await unregisterFeed(DEFAULT_FEED_URI);
      assertValidResponse(response);
      expect(json).toEqual({
        message: 'Feed unregistered successfully',
      });

      const db = env.DB;
      const { success, results } = await db
        .prepare('SELECT * FROM feeds WHERE feed_uri = ?')
        .bind(DEFAULT_FEED_URI)
        .all();
      expect(success).toBe(true);
      expect(results.length).toBe(0);
    });

    it('Given feed has associated posts When unregister feed is called Then associated posts are deleted', async () => {
      const db = env.DB;
      await db
        .prepare(
          'INSERT INTO posts (cid, did, uri, indexed_at, feed_id) VALUES (?, ?, ?, ?, (SELECT feed_id FROM feeds WHERE feed_uri = ?))'
        )
        .bind(
          'test-cid',
          'did:plc:testuser',
          'at://did:plc:testuser/app.bsky.feed.post/post1',
          new Date().toISOString(),
          DEFAULT_FEED_URI
        )
        .run();

      const { response, json } = await unregisterFeed(DEFAULT_FEED_URI);
      assertValidResponse(response);
      expect(json).toEqual({
        message: 'Feed unregistered successfully',
      });

      const { success, results } = await db
        .prepare('SELECT * FROM posts WHERE feed_id = (SELECT feed_id FROM feeds WHERE feed_uri = ?)')
        .bind(DEFAULT_FEED_URI)
        .all();
      expect(success).toBe(true);
      expect(results.length).toBe(0);
    });
  });
});
