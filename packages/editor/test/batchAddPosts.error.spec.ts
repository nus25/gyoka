import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { assertErrorResponse } from './testUtils';
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

  describe('Error cases', () => {
    it('Given an entry with an empty posts array When batch add is called Then it fails validation', async () => {
      await insertFeed(dummyFeed1);

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [],
        },
      ];

      const { response, json } = await batchAddPosts(entries);
      expect(response.status).toBe(400);
      expect(json.error).toBe('BadRequest');
      expect(json.message).toContain(
        `[{"message":"Too small: expected array to have >=1 items","path":["body","entries",0,"posts"]}]`
      );
    });

    it('Given some feeds do not exist When batch add is called Then only missing feeds return errors', async () => {
      await insertFeed(dummyFeed1);

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [dummyPost1],
        },
        {
          feed: dummyFeed2.uri,
          posts: [dummyPost2],
        },
      ];

      const { response, json } = await batchAddPosts(entries);
      assertValidResponse(response);

      expect(json.results).toHaveLength(2);
      expect(json.results![0].feed).toBe(dummyFeed1.uri);
      expect(json.results![0].results[0].status).toBe('added');

      expect(json.results![1].feed).toBe(dummyFeed2.uri);
      expect(json.results![1].results[0].status).toBe('error');
      expect(json.results![1].results[0].error).toContain('does not exist');

      const db = env.DB;
      const { results: posts } = await db.prepare('SELECT * FROM posts').all();
      expect(posts.length).toBe(1);
    });

    it('Given some posts are invalid When batch add is called Then only invalid posts return errors', async () => {
      await insertFeed(dummyFeed1);

      const invalidPost = {
        uri: 'at://did:plc:author4/app.bsky.feed.post/test-post-4',
        cid: 'bafyreicde789example012cid345xyz123456789012345678901234567890',
        languages: ['invalid123'],
        indexedAt: new Date('2024-01-15T15:00:00Z').toISOString(),
      };

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [dummyPost1, invalidPost, dummyPost2],
        },
      ];

      const { response, json } = await batchAddPosts(entries);
      assertValidResponse(response);

      expect(json.results).toHaveLength(1);
      expect(json.results![0].results).toHaveLength(3);
      expect(json.results![0].results[0].status).toBe('added');
      expect(json.results![0].results[0].uri).toBe(dummyPost1.uri);
      expect(json.results![0].results[1].status).toBe('error');
      expect(json.results![0].results[1].uri).toBe(invalidPost.uri);
      expect(json.results![0].results[1].error).toContain('lowercase alphabetic characters');
      expect(json.results![0].results[2].status).toBe('added');
      expect(json.results![0].results[2].uri).toBe(dummyPost2.uri);

      const db = env.DB;
      const { results: posts } = await db.prepare('SELECT * FROM posts').all();
      expect(posts.length).toBe(2);
    });

    it('Given all feeds are missing When batch add is called Then all posts return errors', async () => {
      const nonExistentFeed = 'at://did:plc:nonexistent/app.bsky.feed.generator/fake';

      const entries = [
        {
          feed: nonExistentFeed,
          posts: [dummyPost1, dummyPost2],
        },
      ];

      const { response, json } = await batchAddPosts(entries);
      assertValidResponse(response);

      expect(json.results).toHaveLength(1);
      expect(json.results![0].results).toHaveLength(2);
      expect(json.results![0].results[0].status).toBe('error');
      expect(json.results![0].results[1].status).toBe('error');

      const db = env.DB;
      const { results: posts } = await db.prepare('SELECT * FROM posts').all();
      expect(posts.length).toBe(0);
    });

    it('Given repost reason is missing repost field When batch add is called Then the post returns an error', async () => {
      await insertFeed(dummyFeed1);

      const postWithInvalidReason = {
        ...dummyPost1,
        reason: {
          $type: 'app.bsky.feed.defs#skeletonReasonRepost',
        },
      };

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [postWithInvalidReason],
        },
      ];

      const { response, json } = await batchAddPosts(entries);
      assertValidResponse(response);

      expect(json.results![0].results[0].status).toBe('error');
      expect(json.results![0].results[0].error).toContain('needs repost field');
    });

    it('Given language list becomes empty after normalization When batch add is called Then the post returns an error', async () => {
      await insertFeed(dummyFeed1);

      const postWithEmptyLanguage = {
        ...dummyPost1,
        languages: [''],
      };

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [postWithEmptyLanguage],
        },
      ];

      const { response, json } = await batchAddPosts(entries);
      assertValidResponse(response);

      expect(json.results![0].results[0].status).toBe('error');
      expect(json.results![0].results[0].error).toBe(
        'At least one valid language code is required'
      );
    });

    it('Given posts array is empty When batch add is called Then it returns 400', async () => {
      await insertFeed(dummyFeed1);

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [],
        },
      ];

      const { response } = await batchAddPosts(entries);
      expect(response.status).toBe(400);
    });

    it('Given feed URI format is invalid When batch add is called Then it returns 400', async () => {
      const entries = [
        {
          feed: 'invalid-uri',
          posts: [dummyPost1],
        },
      ];

      const { response } = await batchAddPosts(entries);
      expect(response.status).toBe(400);
    });

    it('Given post URI format is invalid When batch add is called Then it returns 400', async () => {
      await insertFeed(dummyFeed1);

      const invalidPost = {
        uri: 'invalid-uri',
        cid: dummyPost1.cid,
      };

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [invalidPost],
        },
      ];

      const { response } = await batchAddPosts(entries);
      expect(response.status).toBe(400);
    });

    it('Given a DB exception occurs while querying feeds When batch add is called Then it returns 500', async () => {
      const mockDb = {
        prepare: (query: string) => {
          if (query.includes('SELECT')) {
            return {
              bind: (..._args: any[]) => ({
                all: async () => {
                  throw new Error('Database connection failed');
                },
              }),
            };
          }
          return {
            bind: (..._args: any[]) => ({
              run: async () => ({ success: true, meta: { changes: 0 } }),
              all: async () => ({ success: true, results: [] }),
            }),
          };
        },
        batch: async () => {
          throw new Error('Batch operation failed');
        },
      };

      const mockEnv: Partial<Env> = { DB: mockDb as unknown as D1Database };

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [dummyPost1],
        },
      ];

      const { response, json } = await batchAddPosts(entries, mockEnv);

      expect(response.status).toBe(500);
      assertErrorResponse(json);
      expect(json.error).toBe('InternalServerError');
      expect(json.message).toContain('Failed to query feeds');
    });

    it('Given feed query result has success=false When batch add is called Then it returns 500', async () => {
      const mockDb = {
        prepare: (_query: string) => ({
          bind: (..._args: any[]) => ({
            all: async () => ({
              success: false,
              results: [],
            }),
            run: async () => ({ success: true, meta: { changes: 0 } }),
          }),
        }),
        batch: async () => [],
      };

      const mockEnv: Partial<Env> = { DB: mockDb as unknown as D1Database };

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [dummyPost1],
        },
      ];

      const { response, json } = await batchAddPosts(entries, mockEnv);

      expect(response.status).toBe(500);
      assertErrorResponse(json);
      expect(json.error).toBe('InternalServerError');
      expect(json.message).toContain('Failed to query feeds');
    });

    it('Given DB batch results contain failed items When batch add is called Then corresponding posts are marked as error', async () => {
      const mockDb = {
        prepare: (query: string) => ({
          bind: (..._args: any[]) => ({
            all: async () => {
              if (query.includes('SELECT feed_id, feed_uri FROM feeds')) {
                return {
                  success: true,
                  results: [{ feed_id: 1, feed_uri: dummyFeed1.uri }],
                };
              }
              return { success: true, results: [] };
            },
            run: async () => ({ success: true, meta: { changes: 1 } }),
          }),
        }),
        batch: async () => [{ success: true }, { success: false }],
      };

      const mockEnv: Partial<Env> = { DB: mockDb as unknown as D1Database };

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [dummyPost1],
        },
      ];

      const { response, json } = await batchAddPosts(entries, mockEnv);

      expect(response.status).toBe(200);
      expect(json.results![0].results[0].status).toBe('error');
      expect(json.results![0].results[0].error).toBe('Failed to add post to DB');
    });

    it('Given a DB exception occurs during batch insert When batch add is called Then corresponding posts are marked as error', async () => {
      const mockDb = {
        prepare: (query: string) => ({
          bind: (..._args: any[]) => ({
            all: async () => {
              if (query.includes('SELECT')) {
                return {
                  success: true,
                  results: [{ feed_id: 1, feed_uri: dummyFeed1.uri }],
                };
              }
              return { success: true, results: [] };
            },
            run: async () => ({ success: true, meta: { changes: 1 } }),
          }),
        }),
        batch: async () => {
          throw new Error('Batch insert failed');
        },
      };

      const mockEnv: Partial<Env> = { DB: mockDb as unknown as D1Database };

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [dummyPost1],
        },
      ];

      const { response, json } = await batchAddPosts(entries, mockEnv);

      expect(response.status).toBe(200);
      expect(json.results![0].results[0].status).toBe('error');
      expect(json.results![0].results[0].error).toBe('Failed to add post to DB');
    });

    it('Given a UNIQUE constraint violation occurs When batch add is called Then duplicate-specific error is returned', async () => {
      const mockDb = {
        prepare: (query: string) => ({
          bind: (..._args: any[]) => ({
            all: async () => {
              if (query.includes('SELECT')) {
                return {
                  success: true,
                  results: [{ feed_id: 1, feed_uri: dummyFeed1.uri }],
                };
              }
              return { success: true, results: [] };
            },
            run: async () => ({ success: true, meta: { changes: 1 } }),
          }),
        }),
        batch: async () => {
          throw new Error('UNIQUE constraint failed: posts.feed_id, posts.cid, posts.indexed_at');
        },
      };

      const mockEnv: Partial<Env> = { DB: mockDb as unknown as D1Database };

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [dummyPost1],
        },
      ];

      const { response, json } = await batchAddPosts(entries, mockEnv);

      expect(response.status).toBe(200);
      expect(json.results![0].results[0].status).toBe('error');
      expect(json.results![0].results[0].error).toContain('Post already exists. uri:');
      expect(json.results![0].results[0].error).toContain(`uri:${dummyPost1.uri}`);
      expect(json.results![0].results[0].error).toContain(`indexedAt:${dummyPost1.indexedAt}`);
    });
  });
});
