import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';

import {
  ENDPOINT_PATH,
  assertValidResponse,
  batchRemovePosts,
  dummyFeed1,
  dummyFeed2,
  insertFeed,
  insertPost,
  resetBatchRemoveTables,
} from './batchRemovePosts.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetBatchRemoveTables();
  });

  describe('Boundary cases', () => {
    it('Given total posts exceed the limit by one When batch remove is called Then it returns 400', async () => {
      await insertFeed(dummyFeed1);
      await insertFeed(dummyFeed2);

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: Array.from({ length: 13 }, (_, i) => ({
            uri: `at://did:plc:author${i}/app.bsky.feed.post/test-post-${i}`,
            indexedAt: new Date(Date.UTC(2024, 0, 15, 12 + i, 0, 0)).toISOString(),
          })),
        },
        {
          feed: dummyFeed2.uri,
          posts: Array.from({ length: 13 }, (_, i) => ({
            uri: `at://did:plc:author${i + 13}/app.bsky.feed.post/test-post-${i + 13}`,
            indexedAt: new Date(Date.UTC(2024, 0, 15, 12 + i + 13, 0, 0)).toISOString(),
          })),
        },
      ];

      const { response, json } = await batchRemovePosts(entries);
      expect(response.status).toBe(400);
      expect(json.error).toBe('BadRequest');
      expect(json.message).toContain('Maximum 25 posts allowed per request. Received 26 posts.');
    });

    it('Given total posts are exactly at the limit When batch remove is called Then all posts are removed', async () => {
      const feedId1 = await insertFeed(dummyFeed1);

      const posts = Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        uri: `at://did:plc:author${i}/app.bsky.feed.post/test-post-${i}`,
        cid: `bafyreia${i.toString().padStart(50, '0')}`,
        indexedAt: new Date(Date.UTC(2024, 0, 15, 12 + i, 0, 0)).toISOString(),
        langs: ['en'],
      }));

      for (const post of posts) {
        await insertPost(feedId1, post);
      }

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: posts.map((p) => ({ uri: p.uri, indexedAt: p.indexedAt })),
        },
      ];

      const { response, json } = await batchRemovePosts(entries);
      assertValidResponse(response);

      expect(json.results![0].results).toHaveLength(25);
      expect(json.results![0].results.every((r) => r.status === 'removed')).toBe(true);

      const db = env.DB;
      const { results } = await db
        .prepare('SELECT * FROM posts WHERE feed_id = ?')
        .bind(feedId1)
        .all();
      expect(results.length).toBe(0);
    });
  });
});
