import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';

import {
  ENDPOINT_PATH,
  addPost,
  dummyFeed,
  dummyPost,
  insertFeed,
  resetAddPostTables,
} from './addPost.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetAddPostTables();
  });

  describe('Error cases', () => {
    it('Given feed URI is invalid When add post is called Then it returns bad request', async () => {
      const { response } = await addPost('invalid-uri', dummyPost);
      expect(response.status).toBe(400);
    });

    it('Given feed does not exist When add post is called Then it returns unknown feed', async () => {
      const { response, json } = await addPost(
        'at://did:plc:nonexistent/app.bsky.feed.generator/feed',
        dummyPost
      );
      expect(response.status).toBe(404);
      expect(json).toEqual({
        error: 'UnknownFeed',
        message:
          'Feed with URI at://did:plc:nonexistent/app.bsky.feed.generator/feed does not exist.',
      });
    });

    it('Given post URI is invalid When add post is called Then it returns bad request', async () => {
      await insertFeed(dummyFeed);

      const invalidPost = {
        ...dummyPost,
        uri: 'invalid-uri',
      };

      const { response } = await addPost(dummyFeed.uri, invalidPost);
      expect(response.status).toBe(400);
    });

    it('Given invalid language codes are provided When add post is called Then it returns bad request', async () => {
      await insertFeed(dummyFeed);

      const postWithInvalidLangs = {
        ...dummyPost,
        languages: ['invalid', '11'],
      };

      const { response, json } = await addPost(dummyFeed.uri, postWithInvalidLangs);
      expect(response.status).toBe(400);
      expect(json).toEqual({
        error: 'BadRequest',
        message:
          'All primary language tags must be exactly two or three lowercase alphabetic characters (e.g., "en", "jp").',
      });
    });

    it('Given repost reason is missing repost field When add post is called Then it returns bad request', async () => {
      await insertFeed(dummyFeed);

      const postWithInvalidReason = {
        ...dummyPost,
        reason: {
          $type: 'app.bsky.feed.defs#skeletonReasonRepost' as const,
        },
      } as any;
      const { response, json } = await addPost(dummyFeed.uri, postWithInvalidReason);
      expect(response.status).toBe(400);
      expect(json).toEqual({
        error: 'BadRequest',
        message: 'Reason type app.bsky.feed.defs#skeletonReasonRepost needs repost field',
      });
    });

    it('Given database schema is broken When add post is called Then it returns internal server error', async () => {
      await insertFeed(dummyFeed);
      const db = env.DB;
      await db.prepare('DROP TABLE posts').run();

      const { response } = await addPost(dummyFeed.uri, dummyPost);
      expect(response.status).toBe(500);
    });

    it('Given post insert reports failure When add post is called Then it returns internal server error', async () => {
      const mockEnv: Partial<Env> = {
        DB: {
          prepare: () => ({
            bind: (...bindArgs: unknown[]) => {
              if (bindArgs.length === 6) {
                // 6: uri, cid, feed_id, indexed_at, reason, feed_context
                return {
                  all: async () => ({ success: false, results: [] }),
                };
              }
              return {};
            },
          }),
          batch: async () => [{ success: true }],
        } as unknown as D1Database,
      };

      const { response, json } = await addPost(dummyFeed.uri, dummyPost, mockEnv);
      expect(response.status).toBe(500);
      expect(json).toEqual({
        error: 'InternalServerError',
        message: 'Failed to insert post to the database',
      });
    });

    it('Given adding post languages fails When add post is called Then it returns internal server error', async () => {
      const mockEnv: Partial<Env> = {
        DB: {
          prepare: () => ({
            bind: (...bindArgs: unknown[]) => {
              if (bindArgs.length === 6) {
                // 6: uri, cid, feed_id, indexed_at, reason, feed_context
                return {
                  all: async () => ({ success: true, results: [{ post_id: 1 }] }),
                };
              }
              return {};
            },
          }),
          batch: async () => [{ success: false }],
        } as unknown as D1Database,
      };

      const { response, json } = await addPost(dummyFeed.uri, dummyPost, mockEnv);
      expect(response.status).toBe(500);
      expect(json).toEqual({
        error: 'InternalServerError',
        message: 'Failed to add post languages to DB',
      });
    });
  });
});
