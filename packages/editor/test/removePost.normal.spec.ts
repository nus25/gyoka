import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ENDPOINT_PATH,
  assertValidResponse,
  dummyFeed,
  dummyPost,
  insertFeed,
  insertPost,
  removePost,
  resetRemovePostTables,
  verifyPostExists,
  verifyPostLanguagesExist,
} from './removePost.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetRemovePostTables();
  });

  describe('Success cases', () => {
    it('Given a post exists When remove is called with URI only Then the post is removed', async () => {
      const feedId = await insertFeed(dummyFeed);
      await insertPost(feedId, dummyPost);
      expect(await verifyPostLanguagesExist(dummyPost.id)).toBe(true);

      const { response, json } = await removePost(dummyFeed.uri, { uri: dummyPost.uri });
      assertValidResponse(response);
      expect(json).toEqual({
        message: 'Post removed successfully',
        feed: dummyFeed.uri,
        post: {
          uri: dummyPost.uri,
        },
      });

      const exists = await verifyPostExists(dummyPost.uri);
      expect(exists).toBe(false);
      expect(await verifyPostLanguagesExist(dummyPost.id)).toBe(false);
    });

    it('Given a post exists When remove is called with specific indexedAt Then the post is removed', async () => {
      const feedId = await insertFeed(dummyFeed);
      await insertPost(feedId, dummyPost);
      expect(await verifyPostLanguagesExist(dummyPost.id)).toBe(true);

      const { response } = await removePost(dummyFeed.uri, {
        uri: dummyPost.uri,
        indexedAt: new Date(dummyPost.indexedAt).toISOString(),
      });
      assertValidResponse(response);

      const exists = await verifyPostExists(dummyPost.uri);
      expect(exists).toBe(false);
      expect(await verifyPostLanguagesExist(dummyPost.id)).toBe(false);
    });

    it('Given developer mode is toggled on and off When remove is called Then logging behavior is toggled', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const feedId = await insertFeed(dummyFeed);
      const post1 = {
        ...dummyPost,
        id: 1001,
        uri: 'at://did:plc:testuser/app.bsky.feed.post/test-post-dev-1',
      };
      const post2 = {
        ...dummyPost,
        id: 1002,
        uri: 'at://did:plc:testuser/app.bsky.feed.post/test-post-dev-2',
      };
      await insertPost(feedId, post1);
      await insertPost(feedId, post2);

      const { response: disabledResponse } = await removePost(
        dummyFeed.uri,
        { uri: post1.uri },
        { DEVELOPER_MODE: undefined }
      );
      expect(disabledResponse.status).toBe(200);
      expect(logSpy).not.toHaveBeenCalled();

      logSpy.mockClear();

      const { response: enabledResponse } = await removePost(
        dummyFeed.uri,
        { uri: post2.uri },
        { DEVELOPER_MODE: 'enabled' }
      );
      expect(enabledResponse.status).toBe(200);
      expect(logSpy).toHaveBeenCalledWith('feed uri:', dummyFeed.uri, 'post:', { uri: post2.uri });

      logSpy.mockRestore();
    });
  });
});
