import { env } from 'cloudflare:test';
import { All_LANGS } from 'shared/src/constants';
import { describe, it, expect, beforeEach } from 'vitest';

import {
  ENDPOINT_PATH,
  assertValidResponse,
  batchAddPosts,
  dummyFeed1,
  dummyFeed2,
  dummyPost1,
  dummyPost2,
  dummyPost3,
  insertFeed,
  resetBatchAddTables,
} from './batchAddPosts.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetBatchAddTables();
  });

  describe('Success cases', () => {
    it('Given multiple feeds and posts When batch add is called Then all posts are added', async () => {
      await insertFeed(dummyFeed1);
      await insertFeed(dummyFeed2);

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [dummyPost1, dummyPost2],
        },
        {
          feed: dummyFeed2.uri,
          posts: [dummyPost3],
        },
      ];

      const { response, json } = await batchAddPosts(entries);
      assertValidResponse(response);

      expect(json.results).toHaveLength(2);
      expect(json.results![0].feed).toBe(dummyFeed1.uri);
      expect(json.results![0].results).toHaveLength(2);
      expect(json.results![0].results[0].status).toBe('added');
      expect(json.results![0].results[0].uri).toBe(dummyPost1.uri);
      expect(json.results![0].results[1].status).toBe('added');
      expect(json.results![0].results[1].uri).toBe(dummyPost2.uri);

      expect(json.results![1].feed).toBe(dummyFeed2.uri);
      expect(json.results![1].results).toHaveLength(1);
      expect(json.results![1].results[0].status).toBe('added');
      expect(json.results![1].results[0].uri).toBe(dummyPost3.uri);

      const db = env.DB;
      const { results: posts } = await db.prepare('SELECT * FROM posts').all();
      expect(posts.length).toBe(3);
    });

    it('Given multiple entries for the same feed When batch add is called Then entries are processed in input order', async () => {
      await insertFeed(dummyFeed1);

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [dummyPost1],
        },
        {
          feed: dummyFeed1.uri,
          posts: [dummyPost2],
        },
        {
          feed: dummyFeed1.uri,
          posts: [dummyPost3],
        },
      ];

      const { response, json } = await batchAddPosts(entries);
      assertValidResponse(response);

      expect(json.results).toHaveLength(3);
      expect(json.results![0].feed).toBe(dummyFeed1.uri);
      expect(json.results![1].feed).toBe(dummyFeed1.uri);
      expect(json.results![2].feed).toBe(dummyFeed1.uri);

      const db = env.DB;
      const { results: posts } = await db.prepare('SELECT * FROM posts').all();
      expect(posts.length).toBe(3);
    });

    it('Given uppercase and regional language codes When batch add is called Then codes are normalized and saved', async () => {
      await insertFeed(dummyFeed1);

      const postWithMixedLangs = {
        ...dummyPost1,
        languages: ['en-US', 'JA-JP', 'EN', 'JA'],
      };

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [postWithMixedLangs],
        },
      ];

      const { response, json } = await batchAddPosts(entries);
      assertValidResponse(response);

      expect(json.results![0].results[0].status).toBe('added');

      const db = env.DB;
      const { results: posts } = await db
        .prepare('SELECT * FROM posts WHERE uri = ?')
        .bind(dummyPost1.uri)
        .all();
      expect(posts.length).toBe(1);

      const { results: languages } = await db
        .prepare('SELECT DISTINCT language FROM post_languages WHERE post_id = ?')
        .bind(posts[0].post_id)
        .all();
      expect(languages.length).toBe(2);
      expect(languages.map((l) => l.language).sort()).toEqual(['en', 'ja']);
    });

    it('Given wildcard and specific languages are mixed When batch add is called Then wildcard takes precedence', async () => {
      await insertFeed(dummyFeed1);

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [
            {
              ...dummyPost1,
              languages: ['*', 'en'],
            },
          ],
        },
      ];

      const { response, json } = await batchAddPosts(entries);
      assertValidResponse(response);
      expect(json.results![0].results[0].status).toBe('added');

      const db = env.DB;
      const { results: posts } = await db
        .prepare('SELECT * FROM posts WHERE uri = ?')
        .bind(dummyPost1.uri)
        .all();
      const { results: languages } = await db
        .prepare('SELECT language FROM post_languages WHERE post_id = ?')
        .bind(posts[0].post_id)
        .all();
      expect(languages).toEqual([{ language: All_LANGS }]);
    });

    it('Given duplicate posts across entries When batch add is called Then each entry still returns a result', async () => {
      await insertFeed(dummyFeed1);

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [dummyPost1],
        },
        {
          feed: dummyFeed1.uri,
          posts: [dummyPost1],
        },
      ];

      const { response, json } = await batchAddPosts(entries);
      assertValidResponse(response);

      expect(json.results![0].results[0].status).toBe('added');
      expect(json.results![1].results[0].status).toBe('added');
    });

    it('Given a post with only required fields When batch add is called Then it is added', async () => {
      await insertFeed(dummyFeed1);

      const minimalPost = {
        uri: dummyPost1.uri,
        cid: dummyPost1.cid,
      };

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [minimalPost],
        },
      ];

      const { response, json } = await batchAddPosts(entries);
      assertValidResponse(response);

      expect(json.results![0].results[0].status).toBe('added');

      const db = env.DB;
      const { results: posts } = await db
        .prepare('SELECT * FROM posts WHERE uri = ?')
        .bind(dummyPost1.uri)
        .all();
      expect(posts.length).toBe(1);

      const { results: languages } = await db
        .prepare('SELECT * FROM post_languages WHERE post_id = ?')
        .bind(posts[0].post_id)
        .all();
      expect(languages.length).toBe(1);
      expect(languages[0].language).toBe(All_LANGS);
    });

    it('Given a post with feedContext When batch add is called Then feedContext is saved', async () => {
      await insertFeed(dummyFeed1);

      const postWithContext = {
        ...dummyPost1,
        feedContext: 'Test context',
      };

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [postWithContext],
        },
      ];

      const { response, json } = await batchAddPosts(entries);
      assertValidResponse(response);

      expect(json.results![0].results[0].status).toBe('added');

      const db = env.DB;
      const { results: posts } = await db
        .prepare('SELECT * FROM posts WHERE uri = ?')
        .bind(dummyPost1.uri)
        .all();
      expect(posts.length).toBe(1);
      expect(posts[0].feed_context).toBe('Test context');
    });

    it('Given a post with repost reason When batch add is called Then reason is saved', async () => {
      await insertFeed(dummyFeed1);

      const postWithReason = {
        ...dummyPost1,
        reason: {
          $type: 'app.bsky.feed.defs#skeletonReasonRepost',
          repost: 'at://did:plc:testuser/app.bsky.feed.repost/repostkey',
        },
      };

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [postWithReason],
        },
      ];

      const { response, json } = await batchAddPosts(entries);
      assertValidResponse(response);

      expect(json.results![0].results[0].status).toBe('added');

      const db = env.DB;
      const { results: posts } = await db
        .prepare('SELECT * FROM posts WHERE uri = ?')
        .bind(dummyPost1.uri)
        .all();
      expect(posts.length).toBe(1);
      expect(JSON.parse(posts[0].reason as string)).toEqual({
        $type: 'app.bsky.feed.defs#skeletonReasonRepost',
        repost: 'at://did:plc:testuser/app.bsky.feed.repost/repostkey',
      });
    });

    it('Given a post with pin reason When batch add is called Then reason is saved', async () => {
      await insertFeed(dummyFeed1);

      const postWithPinReason = {
        ...dummyPost1,
        reason: {
          $type: 'app.bsky.feed.defs#skeletonReasonPin',
        },
      };

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [postWithPinReason],
        },
      ];

      const { response, json } = await batchAddPosts(entries);
      assertValidResponse(response);

      expect(json.results![0].results[0].status).toBe('added');

      const db = env.DB;
      const { results: posts } = await db
        .prepare('SELECT * FROM posts WHERE uri = ?')
        .bind(dummyPost1.uri)
        .all();
      expect(posts.length).toBe(1);
      expect(JSON.parse(posts[0].reason as string)).toEqual({
        $type: 'app.bsky.feed.defs#skeletonReasonPin',
      });
    });
  });
});
