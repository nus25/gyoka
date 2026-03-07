import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  ENDPOINT_PATH,
  assertGetPostsResponse,
  assertValidResponse,
  dummyFeed,
  getPosts,
  insertFeed,
  insertPost,
  resetGetPostsTables,
} from './getPosts.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetGetPostsTables();
  });

  describe('Success cases', () => {
    it('Given posts exist When get posts is called with default params Then posts are returned in descending order', async () => {
      const feedId = await insertFeed(dummyFeed);
      const posts = Array.from({ length: 5 }, (_, i) => ({
        id: i,
        uri: `at://did:plc:testuser/app.bsky.post/test-${i}`,
        cid: `cid-${i}`,
        indexedAt: new Date(2024, 0, i + 1).toISOString(),
        languages: ['en'],
      }));

      for (const post of posts) {
        await insertPost(feedId, post);
      }

      const { response, json } = await getPosts(dummyFeed.uri);
      assertValidResponse(response);
      assertGetPostsResponse(json);
      expect(json.feed).toBe(dummyFeed.uri);
      expect(json.posts).toHaveLength(5);
      expect(json.posts[0].uri).toBe(posts[4].uri);
      expect(json.posts[0].languages).toEqual(['en']);
      expect(json.posts[0].langs).toEqual(['en']);
    });

    it('Given enough posts for multiple pages When cursor pagination is used Then pages are returned in correct order', async () => {
      const feedId = await insertFeed(dummyFeed);
      const posts = Array.from({ length: 10 }, (_, i) => ({
        id: i,
        uri: `at://did:plc:testuser/app.bsky.post/test-${i}`,
        cid: `cid-${i}`,
        indexedAt: new Date(2024, 0, i + 1).toISOString(),
        languages: ['en'],
      }));

      for (const post of posts) {
        await insertPost(feedId, post);
      }

      const { json: firstPage } = await getPosts(dummyFeed.uri, 5);
      assertGetPostsResponse(firstPage);
      expect(firstPage.posts).toHaveLength(5);
      expect(firstPage.cursor).toBeDefined();

      const { json: secondPage } = await getPosts(dummyFeed.uri, 6, firstPage.cursor);
      assertGetPostsResponse(secondPage);
      expect(secondPage.feed).toBe(dummyFeed.uri);
      expect(secondPage.posts).toHaveLength(5);
      expect(secondPage.cursor).toBeUndefined();

      const allPosts = [...firstPage.posts, ...secondPage.posts];
      expect(allPosts.map((p) => p.uri)).toEqual(posts.reverse().map((p) => p.uri));
    });

    it('Given feed has no posts When get posts is called Then empty posts are returned', async () => {
      await insertFeed(dummyFeed);
      const { response, json } = await getPosts(dummyFeed.uri);
      assertValidResponse(response);
      assertGetPostsResponse(json);
      expect(json.feed).toBe(dummyFeed.uri);
      expect(json.posts).toEqual([]);
      expect(json.cursor).toBeUndefined();
    });

    it('Given post has multiple languages When get posts is called Then grouped languages are returned', async () => {
      const feedId = await insertFeed(dummyFeed);
      const post = {
        id: 1,
        uri: 'at://did:plc:testuser/app.bsky.post/test',
        cid: 'test-cid',
        indexedAt: new Date().toISOString(),
        languages: ['en', 'ja', 'fr'],
      };

      await insertPost(feedId, post);

      const { json } = await getPosts(dummyFeed.uri);
      assertGetPostsResponse(json);
      expect(json.posts).toHaveLength(1);
      expect(json.posts[0].languages).toEqual(expect.arrayContaining(['en', 'ja', 'fr']));
      expect(json.posts[0].langs).toEqual(expect.arrayContaining(['en', 'ja', 'fr']));
    });

    it('Given post has wildcard language When get posts is called Then wildcard is returned as array', async () => {
      const feedId = await insertFeed(dummyFeed);
      await insertPost(feedId, {
        id: 10,
        uri: 'at://did:plc:testuser/app.bsky.post/wildcard',
        cid: 'wildcard-cid',
        indexedAt: new Date().toISOString(),
        languages: ['*'],
      });

      const { json } = await getPosts(dummyFeed.uri);
      assertGetPostsResponse(json);
      expect(json.posts[0].languages).toEqual(['*']);
      expect(json.posts[0].langs).toEqual(['*']);
    });

    it('Given developer mode is toggled on and off When get posts is called Then logging behavior is toggled', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await insertFeed(dummyFeed);

      const { response: disabledResponse } = await getPosts(dummyFeed.uri, 10, undefined, {
        DEVELOPER_MODE: undefined,
      });
      expect(disabledResponse.status).toBe(200);
      expect(logSpy).not.toHaveBeenCalled();

      logSpy.mockClear();

      const { response: enabledResponse } = await getPosts(dummyFeed.uri, 10, undefined, {
        DEVELOPER_MODE: 'enabled',
      });
      expect(enabledResponse.status).toBe(200);
      expect(logSpy).toHaveBeenCalled();

      const payload = JSON.parse(logSpy.mock.calls[0][0] as string) as Record<string, unknown>;
      expect(payload.level).toBe('debug');
      expect(payload.event).toBe('db.query.posts.start');
      expect(payload.query).toBeTypeOf('string');
      expect(Array.isArray(payload.bindings)).toBe(true);

      logSpy.mockRestore();
    });
  });
});
