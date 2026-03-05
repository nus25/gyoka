import { describe, it, expect, beforeEach } from 'vitest';

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

  describe('Boundary cases', () => {
    it('Given remain is zero When trim is called Then all posts are deleted', async () => {
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

      const { response, json } = await trimFeed(dummyFeed.uri, 0);
      assertValidResponse(response);
      expect(json).toEqual({
        message: 'Posts trimed successfully',
        feed: dummyFeed.uri,
        deletedCount: 10,
      });

      const remainingCount = await countPosts(feedId);
      expect(remainingCount).toBe(0);
    });

    it('Given remain exceeds current post count When trim is called Then no post is deleted', async () => {
      const feedId = await insertFeed(dummyFeed);
      const posts = Array.from({ length: 3 }, (_, i) => ({
        id: i,
        uri: `at://did:plc:testuser/app.bsky.post/test-${i}`,
        cid: `cid-test-${i}`,
        indexedAt: new Date(2024, 0, i + 1).toISOString(),
        langs: ['en'],
      }));

      for (const post of posts) {
        await insertPost(feedId, post);
      }

      const { response, json } = await trimFeed(dummyFeed.uri, 5);
      assertValidResponse(response);
      assertTrimFeedResponse(json);
      expect(json.deletedCount).toBe(0);

      const remainingCount = await countPosts(feedId);
      expect(remainingCount).toBe(3);
    });
  });
});
