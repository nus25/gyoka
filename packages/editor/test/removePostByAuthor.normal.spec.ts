import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ENDPOINT_PATH,
  assertRemovePostByAuthorResponse,
  assertValidResponse,
  author1Did,
  author2Did,
  countPostsByAuthor,
  countPostLanguagesByPostId,
  countTotalPosts,
  dummyFeed,
  dummyPosts,
  insertFeed,
  insertPost,
  removePostByAuthor,
  resetRemovePostByAuthorTables,
} from './removePostByAuthor.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetRemovePostByAuthorTables();
  });

  describe('Success cases', () => {
    it('Given author has multiple posts in feed When remove by author is called Then all author posts are removed', async () => {
      const feedId = await insertFeed(dummyFeed);
      await insertPost(feedId, dummyPosts[0]);
      await insertPost(feedId, dummyPosts[1]);
      await insertPost(feedId, dummyPosts[2]);

      expect(await countPostLanguagesByPostId(dummyPosts[0].id)).toBeGreaterThan(0);
      expect(await countPostLanguagesByPostId(dummyPosts[1].id)).toBeGreaterThan(0);
      expect(await countPostLanguagesByPostId(dummyPosts[2].id)).toBeGreaterThan(0);

      const { response, json } = await removePostByAuthor(dummyFeed.uri, author1Did);
      assertValidResponse(response);
      expect(json).toEqual({
        message: 'Posts by author removed successfully',
        feed: dummyFeed.uri,
        author: author1Did,
        deletedCount: 2,
      });

      const author1Count = await countPostsByAuthor(author1Did);
      expect(author1Count).toBe(0);

      const author2Count = await countPostsByAuthor(author2Did);
      expect(author2Count).toBe(1);

      const totalCount = await countTotalPosts();
      expect(totalCount).toBe(1);

      expect(await countPostLanguagesByPostId(dummyPosts[0].id)).toBe(0);
      expect(await countPostLanguagesByPostId(dummyPosts[1].id)).toBe(0);
      expect(await countPostLanguagesByPostId(dummyPosts[2].id)).toBeGreaterThan(0);
    });

    it('Given author posts exist in multiple feeds When remove by author is called for one feed Then only posts in that feed are removed', async () => {
      const feed1Id = await insertFeed(dummyFeed);
      const feed2Uri = 'at://did:plc:testuser/app.bsky.feed.generator/other-feed';
      const feed2Id = await insertFeed({ uri: feed2Uri, is_active: 1 });

      await insertPost(feed1Id, { ...dummyPosts[0], id: 5 });
      await insertPost(feed2Id, { ...dummyPosts[0], id: 6 });

      const { response, json } = await removePostByAuthor(dummyFeed.uri, author1Did);
      assertValidResponse(response);
      assertRemovePostByAuthorResponse(json);
      expect(json.deletedCount).toBe(1);

      const author1Count = await countPostsByAuthor(author1Did);
      expect(author1Count).toBe(1);
    });

    it('Given author posts with mixed languages and timestamps When remove by author is called Then all author posts are removed', async () => {
      const feedId = await insertFeed(dummyFeed);
      const post1 = { ...dummyPosts[0], id: 1, langs: ['en'] };
      const post2 = {
        ...dummyPosts[1],
        id: 2,
        langs: ['ja', 'ko'],
        indexedAt: new Date(Date.now() - 86400000).toISOString(),
      };
      const post3 = {
        ...dummyPosts[0],
        id: 3,
        uri: `at://${author1Did}/app.bsky.feed.post/post3`,
        indexedAt: new Date(Date.now() - 172800000).toISOString(),
      };

      await insertPost(feedId, post1);
      await insertPost(feedId, post2);
      await insertPost(feedId, post3);

      expect(await countPostLanguagesByPostId(post1.id)).toBeGreaterThan(0);
      expect(await countPostLanguagesByPostId(post2.id)).toBeGreaterThan(0);
      expect(await countPostLanguagesByPostId(post3.id)).toBeGreaterThan(0);

      const { response, json } = await removePostByAuthor(dummyFeed.uri, author1Did);
      assertValidResponse(response);
      assertRemovePostByAuthorResponse(json);
      expect(json.deletedCount).toBe(3);

      const author1Count = await countPostsByAuthor(author1Did);
      expect(author1Count).toBe(0);

      expect(await countPostLanguagesByPostId(post1.id)).toBe(0);
      expect(await countPostLanguagesByPostId(post2.id)).toBe(0);
      expect(await countPostLanguagesByPostId(post3.id)).toBe(0);
    });

    it('Given developer mode is toggled on and off When remove by author is called Then logging behavior is toggled', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const feedId = await insertFeed(dummyFeed);
      await insertPost(feedId, {
        ...dummyPosts[0],
        id: 2001,
        uri: `at://${author1Did}/app.bsky.feed.post/dev-post-1`,
      });
      await insertPost(feedId, {
        ...dummyPosts[2],
        id: 2002,
        uri: `at://${author2Did}/app.bsky.feed.post/dev-post-2`,
      });

      const { response: disabledResponse } = await removePostByAuthor(dummyFeed.uri, author1Did, {
        DEVELOPER_MODE: undefined,
      });
      expect(disabledResponse.status).toBe(200);
      expect(logSpy).not.toHaveBeenCalled();

      logSpy.mockClear();

      const { response: enabledResponse } = await removePostByAuthor(dummyFeed.uri, author2Did, {
        DEVELOPER_MODE: 'enabled',
      });
      expect(enabledResponse.status).toBe(200);
      expect(logSpy).toHaveBeenCalled();

      const payload = JSON.parse(logSpy.mock.calls[0][0] as string) as Record<string, unknown>;
      expect(payload.level).toBe('debug');
      expect(payload.event).toBe('db.remove.posts_by_author.start');
      expect(payload.feedId).toBe(feedId);
      expect(payload.author).toBe(author2Did);

      logSpy.mockRestore();
    });
  });
});
