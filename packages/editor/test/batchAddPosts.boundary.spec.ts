import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ENDPOINT_PATH,
  assertValidResponse,
  batchAddPosts,
  dummyFeed1,
  dummyFeed2,
  insertFeed,
  resetBatchAddTables,
} from './batchAddPosts.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetBatchAddTables();
  });

  describe('Boundary cases', () => {
    it('Given total posts exceed the limit by one When batch add is called Then it returns 400', async () => {
      await insertFeed(dummyFeed1);
      await insertFeed(dummyFeed2);

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: Array.from({ length: 12 }, (_, i) => ({
            uri: `at://did:plc:author${i}/app.bsky.feed.post/test-post-${i}`,
            cid: `bafyreia${i.toString().padStart(50, '0')}`,
            indexedAt: new Date(Date.UTC(2024, 0, 15, 12 + i, 0, 0)).toISOString(),
          })),
        },
        {
          feed: dummyFeed2.uri,
          posts: Array.from({ length: 13 }, (_, i) => ({
            uri: `at://did:plc:author${i + 12}/app.bsky.feed.post/test-post-${i + 12}`,
            cid: `bafyreia${(i + 12).toString().padStart(50, '0')}`,
            indexedAt: new Date(Date.UTC(2024, 0, 15, 12 + i + 12, 0, 0)).toISOString(),
          })),
        },
      ];

      entries[1].posts.push({
        uri: 'at://did:plc:author25/app.bsky.feed.post/test-post-25',
        cid: 'bafyreia' + '25'.padStart(50, '0'),
        indexedAt: new Date(Date.UTC(2024, 0, 15, 12 + 25, 0, 0)).toISOString(),
      });

      const { response, json } = await batchAddPosts(entries);
      expect(response.status).toBe(400);
      expect(json.error).toBe('BadRequest');
      expect(json.message).toContain('Maximum 25 posts allowed per request. Received 26 posts.');
    });

    it('Given total posts are exactly at the limit When batch add is called Then all posts are added', async () => {
      await insertFeed(dummyFeed1);
      await insertFeed(dummyFeed2);

      const entries = Array.from({ length: 25 }, (_, i) => ({
        feed: i % 2 === 0 ? dummyFeed1.uri : dummyFeed2.uri,
        posts: [
          {
            uri: `at://did:plc:author${i}/app.bsky.feed.post/test-post-${i}`,
            cid: `bafyreia${i.toString().padStart(50, '0')}`,
            indexedAt: new Date(Date.UTC(2024, 0, 15, 12 + i, 0, 0)).toISOString(),
          },
        ],
      }));

      const { response, json } = await batchAddPosts(entries);
      assertValidResponse(response);

      expect(json.results).toHaveLength(25);
      expect(json.results!.every((r) => r.results[0].status === 'added')).toBe(true);

      const db = env.DB;
      const { results: posts } = await db.prepare('SELECT * FROM posts').all();
      expect(posts.length).toBe(25);
    });
  });
});
