import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { All_LANGS } from 'shared/src/constants';
import {
  ENDPOINT_PATH,
  addPost,
  assertValidResponse,
  dummyFeed,
  dummyPost,
  insertFeed,
  resetAddPostTables,
} from './addPost.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetAddPostTables();
  });

  describe('Success cases', () => {
    it('Given all post fields are provided When add post is called Then post and languages are persisted', async () => {
      await insertFeed(dummyFeed);
      const { response, json } = await addPost(dummyFeed.uri, dummyPost);
      assertValidResponse(response);
      expect(json).toEqual({
        message: 'Post added successfully',
        feed: dummyFeed.uri,
        post: {
          uri: dummyPost.uri,
          cid: dummyPost.cid,
          languages: dummyPost.languages,
          indexedAt: expect.any(String),
        },
      });

      const db = env.DB;
      const { results: posts } = await db
        .prepare('SELECT * FROM posts WHERE uri = ?')
        .bind(dummyPost.uri)
        .all();
      expect(posts.length).toBe(1);
      const { results: languages } = await db
        .prepare('SELECT * FROM post_languages WHERE post_id = ?')
        .bind(posts[0].post_id)
        .all();
      expect(languages.length).toBe(2);
    });

    it('Given only required post fields are provided When add post is called Then default language is applied', async () => {
      await insertFeed(dummyFeed);

      const minimalPost = {
        uri: dummyPost.uri,
        cid: dummyPost.cid,
      };

      const { response, json } = await addPost(dummyFeed.uri, minimalPost);
      assertValidResponse(response);
      expect(json).toEqual({
        message: 'Post added successfully',
        feed: dummyFeed.uri,
        post: {
          uri: minimalPost.uri,
          cid: minimalPost.cid,
          indexedAt: expect.any(String),
        },
      });

      const db = env.DB;
      const { results: posts } = await db
        .prepare('SELECT * FROM posts WHERE uri = ?')
        .bind(dummyPost.uri)
        .all();
      expect(posts.length).toBe(1);
      const { results: languages } = await db
        .prepare('SELECT * FROM post_languages WHERE post_id = ?')
        .bind(posts[0].post_id)
        .all();
      expect(languages.length).toBe(1);
      expect(languages[0].language).toBe(All_LANGS);
    });

    it('Given mixed language formats are provided When add post is called Then language codes are normalized', async () => {
      await insertFeed(dummyFeed);

      const postWithMixedLangs = {
        ...dummyPost,
        languages: ['en-US', 'JA-JP', 'EN', 'JA', 'tlh'],
      };

      const { response } = await addPost(dummyFeed.uri, postWithMixedLangs);
      assertValidResponse(response);

      const db = env.DB;
      const { results: posts } = await db
        .prepare('SELECT * FROM posts WHERE uri = ?')
        .bind(dummyPost.uri)
        .all();
      expect(posts.length).toBe(1);
      const { results: languages } = await db
        .prepare('SELECT DISTINCT language FROM post_languages WHERE post_id = ?')
        .bind(posts[0].post_id)
        .all();
      expect(languages.length).toBe(3);
      expect(languages.map((l) => l.language).sort()).toEqual(['en', 'ja', 'tlh']);
    });

    it('Given feedContext is provided When add post is called Then feedContext is persisted', async () => {
      await insertFeed(dummyFeed);

      const postWithContext = {
        ...dummyPost,
        feedContext: 'Test context',
      };

      const { response, json } = await addPost(dummyFeed.uri, postWithContext);
      assertValidResponse(response);
      expect(json).toEqual({
        message: 'Post added successfully',
        feed: dummyFeed.uri,
        post: {
          uri: dummyPost.uri,
          cid: dummyPost.cid,
          languages: dummyPost.languages,
          indexedAt: expect.any(String),
          feedContext: 'Test context',
        },
      });

      const db = env.DB;
      const { results: posts } = await db
        .prepare('SELECT * FROM posts WHERE uri = ?')
        .bind(dummyPost.uri)
        .all();
      expect(posts.length).toBe(1);
      expect(posts[0].feed_context).toBe('Test context');
    });

    it('Given repost and pin reasons are provided When add post is called Then reason values are persisted', async () => {
      await insertFeed(dummyFeed);

      const postWithReasonRepost = {
        ...dummyPost,
        reason: {
          $type: 'app.bsky.feed.defs#skeletonReasonRepost' as const,
          repost: 'at://did:plc:testuser/app.bsky.feed.repost/repostkey',
          invalid: 'extra invalid value should be removed',
        },
      };

      const { response, json } = await addPost(dummyFeed.uri, postWithReasonRepost);
      assertValidResponse(response);
      expect(json).toEqual({
        message: 'Post added successfully',
        feed: dummyFeed.uri,
        post: {
          uri: dummyPost.uri,
          cid: dummyPost.cid,
          languages: dummyPost.languages,
          indexedAt: expect.any(String),
          reason: {
            $type: 'app.bsky.feed.defs#skeletonReasonRepost',
            repost: 'at://did:plc:testuser/app.bsky.feed.repost/repostkey',
          },
        },
      });

      const postWithReasonPin = {
        ...dummyPost,
        reason: {
          $type: 'app.bsky.feed.defs#skeletonReasonPin' as const,
        },
      };

      const { response: pinResponse, json: pinJson } = await addPost(
        dummyFeed.uri,
        postWithReasonPin
      );
      assertValidResponse(pinResponse);
      expect(pinJson).toEqual({
        message: 'Post added successfully',
        feed: dummyFeed.uri,
        post: {
          uri: dummyPost.uri,
          cid: dummyPost.cid,
          languages: dummyPost.languages,
          indexedAt: expect.any(String),
          reason: {
            $type: 'app.bsky.feed.defs#skeletonReasonPin',
          },
        },
      });

      const db = env.DB;
      const { results: posts } = await db
        .prepare('SELECT * FROM posts WHERE uri = ?')
        .bind(dummyPost.uri)
        .all();
      expect(posts.length).toBe(2);
      const parsedReasons = posts.map((p) => JSON.parse(p.reason as string));
      expect(parsedReasons).toContainEqual({
        $type: 'app.bsky.feed.defs#skeletonReasonRepost',
        repost: 'at://did:plc:testuser/app.bsky.feed.repost/repostkey',
      });
      expect(parsedReasons).toContainEqual({
        $type: 'app.bsky.feed.defs#skeletonReasonPin',
      });
    });
  });
});
