import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';

import {
  ENDPOINT_PATH,
  dummyFeed,
  getPosts,
  insertFeed,
  resetGetPostsTables,
} from './getPosts.shared';
import { assertErrorResponse } from './testUtils';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetGetPostsTables();
  });

  describe('Error cases', () => {
    it('Given feed URI is invalid When get posts is called Then it returns bad request', async () => {
      const { response, json } = await getPosts('invalid-uri');
      expect(response.status).toBe(400);
      assertErrorResponse(json);
      expect(json.error).toBe('BadRequest');
      expect(json.message).toContain('Invalid AT Protocol URI format');
    });

    it('Given feed does not exist When get posts is called Then it returns unknown feed', async () => {
      const feedUri = 'at://did:plc:nonexistent/app.bsky.feed.generator/feed';
      const { response, json } = await getPosts(feedUri);
      expect(response.status).toBe(404);
      assertErrorResponse(json);
      expect(json.error).toBe('UnknownFeed');
      expect(json.message).toContain('does not exist');
      expect(json.message).toContain(feedUri);
    });

    it('Given cursor is malformed When get posts is called Then it returns bad request', async () => {
      await insertFeed(dummyFeed);
      const { response } = await getPosts(dummyFeed.uri, undefined, 'invalid-cursor');
      expect(response.status).toBe(400);
    });

    it('Given database schema is broken When get posts is called Then it returns internal server error', async () => {
      await insertFeed(dummyFeed);
      const db = env.DB;
      await db.prepare('DROP TABLE posts').run();

      const { response } = await getPosts(dummyFeed.uri);
      expect(response.status).toBe(500);
    });

    it('Given feed existence query fails When get posts is called Then it returns internal server error', async () => {
      const failingFeedCheckEnv: Partial<Env> = {
        DB: {
          prepare: () => ({
            bind: () => ({
              all: async () => ({ success: false, results: [] }),
            }),
          }),
        } as unknown as D1Database,
      };

      const { response, json } = await getPosts(
        dummyFeed.uri,
        undefined,
        undefined,
        failingFeedCheckEnv
      );

      expect(response.status).toBe(500);
      assertErrorResponse(json);
      expect(json.error).toBe('InternalServerError');
      expect(json.message).toContain('Failed to query the database');
    });

    it('Given posts query fails after feed check succeeds When get posts is called Then it returns internal server error', async () => {
      let queryCount = 0;
      const failingPostsQueryEnv: Partial<Env> = {
        DB: {
          prepare: () => ({
            bind: () => ({
              all: async () => {
                queryCount += 1;
                if (queryCount === 1) {
                  return {
                    success: true,
                    results: [{ feed_id: 1 }],
                  };
                }
                return { success: false, results: [] };
              },
            }),
          }),
        } as unknown as D1Database,
      };

      const { response, json } = await getPosts(
        dummyFeed.uri,
        undefined,
        undefined,
        failingPostsQueryEnv
      );

      expect(response.status).toBe(500);
      assertErrorResponse(json);
      expect(json.error).toBe('InternalServerError');
      expect(json.message).toContain('Failed to fetch posts');
    });
  });
});
