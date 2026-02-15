import { describe, it, expect, beforeEach } from 'vitest';
import {
  ENDPOINT_PATH,
  assertRemovePostByAuthorResponse,
  assertValidResponse,
  author1Did,
  countPostsByAuthor,
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

  describe('Boundary cases', () => {
    it('Given author has no posts in feed When remove by author is called Then deletedCount is zero', async () => {
      const feedId = await insertFeed(dummyFeed);
      await insertPost(feedId, dummyPosts[2]);

      const { response, json } = await removePostByAuthor(dummyFeed.uri, author1Did);
      assertValidResponse(response);
      expect(json).toEqual({
        message: 'Posts by author removed successfully',
        feed: dummyFeed.uri,
        author: author1Did,
        deletedCount: 0,
      });

      const totalCount = await countTotalPosts();
      expect(totalCount).toBe(1);
    });

    it('Given author DID partially matches other DID When remove by author is called Then no post is removed', async () => {
      const feedId = await insertFeed(dummyFeed);
      await insertPost(feedId, {
        ...dummyPosts[0],
        id: 4,
        uri: 'at://did:plc:author1extra/app.bsky.feed.post/post4',
      });

      const { response, json } = await removePostByAuthor(dummyFeed.uri, author1Did);
      assertValidResponse(response);
      assertRemovePostByAuthorResponse(json);
      expect(json.deletedCount).toBe(0);

      const totalCount = await countTotalPosts();
      expect(totalCount).toBe(1);
    });

    it('Given same author has posts in two feeds When remove by author is called for one feed Then posts in other feed remain', async () => {
      const feed1Id = await insertFeed(dummyFeed);
      const feed2Uri = 'at://did:plc:testuser/app.bsky.feed.generator/test-feed-2';
      const feed2Id = await insertFeed({ uri: feed2Uri, is_active: 1 });

      await insertPost(feed1Id, dummyPosts[0]);
      await insertPost(feed2Id, {
        ...dummyPosts[0],
        id: 10,
      });

      const { response, json } = await removePostByAuthor(dummyFeed.uri, author1Did);
      assertValidResponse(response);
      assertRemovePostByAuthorResponse(json);
      expect(json.deletedCount).toBe(1);

      const author1Count = await countPostsByAuthor(author1Did);
      expect(author1Count).toBe(1);
    });
  });
});
