import { env } from 'cloudflare:workers';
import { describe, it, expect, beforeEach, vi } from 'vitest';

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
    it('Given MAX_BATCH_POSTS is invalid When total posts exceed default limit Then it returns 400 using default limit', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await insertFeed(dummyFeed1);
      await insertFeed(dummyFeed2);

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: Array.from({ length: 13 }, (_, i) => ({
            uri: `at://did:plc:author${i}/app.bsky.feed.post/test-post-${i}`,
            cid: `bafyreia${i.toString().padStart(50, '0')}`,
            indexedAt: new Date(Date.UTC(2024, 0, 15, 12 + i, 0, 0)).toISOString(),
          })),
        },
        {
          feed: dummyFeed2.uri,
          posts: Array.from({ length: 13 }, (_, i) => ({
            uri: `at://did:plc:author${i + 13}/app.bsky.feed.post/test-post-${i + 13}`,
            cid: `bafyreia${(i + 13).toString().padStart(50, '0')}`,
            indexedAt: new Date(Date.UTC(2024, 0, 15, 12 + i + 13, 0, 0)).toISOString(),
          })),
        },
      ];

      const { response, json } = await batchAddPosts(entries, {
        MAX_BATCH_POSTS: 'invalid',
      });

      expect(response.status).toBe(400);
      expect(json.error).toBe('BadRequest');
      expect(json.message).toContain('Maximum 25 posts allowed per request. Received 26 posts.');

      expect(warnSpy).toHaveBeenCalled();
      const warnEvents = warnSpy.mock.calls.map(
        (call) => (JSON.parse(call[0] as string) as Record<string, unknown>).event
      );
      expect(warnEvents).toContain('config.resolve.max.batch.posts.failed');

      const fallbackWarn = warnSpy.mock.calls
        .map((call) => JSON.parse(call[0] as string) as Record<string, unknown>)
        .find((entry) => entry.event === 'config.resolve.max.batch.posts.failed');
      expect(fallbackWarn?.reason).toBe('invalid');

      warnSpy.mockRestore();
    });

    it('Given MAX_BATCH_POSTS is missing When total posts exceed default limit Then it returns 400 and logs missing fallback', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await insertFeed(dummyFeed1);
      await insertFeed(dummyFeed2);

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: Array.from({ length: 13 }, (_, i) => ({
            uri: `at://did:plc:author${i}/app.bsky.feed.post/test-post-${i}`,
            cid: `bafyreia${i.toString().padStart(50, '0')}`,
            indexedAt: new Date(Date.UTC(2024, 0, 15, 12 + i, 0, 0)).toISOString(),
          })),
        },
        {
          feed: dummyFeed2.uri,
          posts: Array.from({ length: 13 }, (_, i) => ({
            uri: `at://did:plc:author${i + 13}/app.bsky.feed.post/test-post-${i + 13}`,
            cid: `bafyreia${(i + 13).toString().padStart(50, '0')}`,
            indexedAt: new Date(Date.UTC(2024, 0, 15, 12 + i + 13, 0, 0)).toISOString(),
          })),
        },
      ];

      const { response, json } = await batchAddPosts(entries, {
        MAX_BATCH_POSTS: undefined,
      });

      expect(response.status).toBe(400);
      expect(json.error).toBe('BadRequest');
      expect(json.message).toContain('Maximum 25 posts allowed per request. Received 26 posts.');

      expect(warnSpy).toHaveBeenCalled();
      const fallbackWarn = warnSpy.mock.calls
        .map((call) => JSON.parse(call[0] as string) as Record<string, unknown>)
        .find((entry) => entry.event === 'config.resolve.max.batch.posts.failed');
      expect(fallbackWarn?.reason).toBe('missing');

      warnSpy.mockRestore();
    });

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

    it('Given no posts When batch add is called Then it returns 400', async () => {
      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [],
        },
      ];

      const { response, json } = await batchAddPosts(entries);
      expect(response.status).toBe(400);
      expect(json.error).toBe('BadRequest');
      expect(json.message).toContain('Too small');
    });
  });
});
