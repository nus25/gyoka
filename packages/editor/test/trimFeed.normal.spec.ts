import { env } from 'cloudflare:workers';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  ENDPOINT_PATH,
  assertTrimFeedResponse,
  assertValidResponse,
  countPosts,
  dummyFeed,
  insertFeed,
  insertPost,
  resetTrimFeedTables,
  trimFeed,
} from './trimFeed.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetTrimFeedTables();
  });

  describe('Success cases', () => {
    it('Given a feed with many posts When trim is called Then only the specified number of recent posts remain', async () => {
      const feedId = await insertFeed(dummyFeed);
      const posts = Array.from({ length: 10 }, (_, i) => ({
        id: i,
        uri: `at://did:plc:testuser/app.bsky.post/test-${i}`,
        cid: `cid-${i}`,
        indexedAt: new Date(2024, 0, i + 1).toISOString(),
        langs: ['en'],
      }));

      for (const post of posts) {
        await insertPost(feedId, post);
      }

      const { response, json } = await trimFeed(dummyFeed.uri, 5);
      assertValidResponse(response);
      expect(json).toEqual({
        message: 'Posts trimed successfully',
        feed: dummyFeed.uri,
        deletedCount: 5,
      });

      const remainingCount = await countPosts(feedId);
      expect(remainingCount).toBe(5);
    });

    it('Given an empty feed When trim is called Then no post is deleted', async () => {
      await insertFeed(dummyFeed);

      const { response, json } = await trimFeed(dummyFeed.uri, 5);
      assertValidResponse(response);
      assertTrimFeedResponse(json);
      expect(json.deletedCount).toBe(0);
    });

    it('Given posts with different timestamps When trim is called Then the newest posts are kept', async () => {
      const feedId = await insertFeed(dummyFeed);
      const now = new Date();
      const posts = [
        {
          id: 1,
          uri: 'at://did:plc:testuser/app.bsky.post/old',
          cid: 'cid-old',
          indexedAt: new Date(now.getTime() - 1000000).toISOString(),
          langs: ['en'],
        },
        {
          id: 2,
          uri: 'at://did:plc:testuser/app.bsky.post/new',
          cid: 'cid-new',
          indexedAt: now.toISOString(),
          langs: ['en'],
        },
      ];

      for (const post of posts) {
        await insertPost(feedId, post);
      }

      const { response } = await trimFeed(dummyFeed.uri, 1);
      assertValidResponse(response);

      const db = env.DB;
      const { results } = await db
        .prepare('SELECT uri FROM posts WHERE feed_id = ?')
        .bind(feedId)
        .all();
      expect(results).toHaveLength(1);
      expect(results[0].uri).toBe(posts[1].uri);
    });

    it('Given developer mode is toggled on and off When trim is called Then logging behavior is toggled', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const feedId = await insertFeed(dummyFeed);
      const posts = Array.from({ length: 5 }, (_, i) => ({
        id: i,
        uri: `at://did:plc:testuser/app.bsky.post/test-${i}`,
        cid: `cid-${i}`,
        indexedAt: new Date(2024, 0, i + 1).toISOString(),
        langs: ['en'],
      }));

      for (const post of posts) {
        await insertPost(feedId, post);
      }

      const { response: enabledResponse, json: enabledJson } = await trimFeed(dummyFeed.uri, 3, {
        DEVELOPER_MODE: 'enabled',
      });

      expect(enabledResponse.status).toBe(200);
      assertTrimFeedResponse(enabledJson);
      expect(enabledJson.message).toContain('Posts trimed successfully');
      expect(enabledJson.deletedCount).toBe(2);
      expect(logSpy).toHaveBeenCalled();

      const payload = JSON.parse(logSpy.mock.calls[0][0] as string) as Record<string, unknown>;
      expect(payload.level).toBe('debug');
      expect(payload.event).toBe('db.trim.feed.start');
      expect(payload.feedId).toBe(feedId);
      expect(payload.remain).toBe(3);
      expect(payload.feedPosts).toBe(5);

      logSpy.mockClear();

      const { response: disabledResponse, json: disabledJson } = await trimFeed(dummyFeed.uri, 3, {
        DEVELOPER_MODE: undefined,
      });

      expect(disabledResponse.status).toBe(200);
      assertTrimFeedResponse(disabledJson);
      expect(disabledJson.message).toContain('Posts trimed successfully');
      expect(disabledJson.deletedCount).toBe(0);
      expect(logSpy).not.toHaveBeenCalled();

      logSpy.mockRestore();
    });
  });
});
