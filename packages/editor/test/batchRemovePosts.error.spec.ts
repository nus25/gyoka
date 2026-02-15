import { describe, it, expect, beforeEach } from 'vitest';
import { assertErrorResponse } from './testUtils';
import {
  ENDPOINT_PATH,
  assertValidResponse,
  batchRemovePosts,
  dummyFeed1,
  dummyFeed2,
  dummyPost1,
  dummyPost2,
  dummyPost3,
  insertFeed,
  insertPost,
  resetBatchRemoveTables,
  verifyPostExists,
} from './batchRemovePosts.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetBatchRemoveTables();
  });

  describe('Error cases', () => {
    it('Given an entry with an empty posts array When batch remove is called Then it fails validation', async () => {
      await insertFeed(dummyFeed1);

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [],
        },
      ];

      const { response, json } = await batchRemovePosts(entries);
      expect(response.status).toBe(400);
      expect(json.error).toBe('BadRequest');
      expect(json.message).toContain(
        `[{"message":"Too small: expected array to have >=1 items","path":["body","entries",0,"posts"]}]`
      );
    });

    it('Given some feeds do not exist When batch remove is called Then only missing feeds return errors', async () => {
      const feedId1 = await insertFeed(dummyFeed1);
      await insertPost(feedId1, dummyPost1);

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [{ uri: dummyPost1.uri, indexedAt: dummyPost1.indexedAt }],
        },
        {
          feed: dummyFeed2.uri,
          posts: [{ uri: dummyPost2.uri, indexedAt: dummyPost2.indexedAt }],
        },
      ];

      const { response, json } = await batchRemovePosts(entries);
      assertValidResponse(response);

      expect(json.results).toHaveLength(2);
      expect(json.results![0].feed).toBe(dummyFeed1.uri);
      expect(json.results![0].results[0].status).toBe('removed');

      expect(json.results![1].feed).toBe(dummyFeed2.uri);
      expect(json.results![1].results[0].status).toBe('error');
      expect(json.results![1].results[0].error).toContain('does not exist');

      expect(await verifyPostExists(dummyPost1.uri)).toBe(false);
    });

    it('Given some posts do not exist When batch remove is called Then only missing posts return errors', async () => {
      const feedId1 = await insertFeed(dummyFeed1);
      await insertPost(feedId1, dummyPost1);
      await insertPost(feedId1, dummyPost3);

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [
            { uri: dummyPost1.uri, indexedAt: dummyPost1.indexedAt },
            { uri: dummyPost2.uri, indexedAt: dummyPost2.indexedAt },
            { uri: dummyPost3.uri, indexedAt: dummyPost3.indexedAt },
          ],
        },
      ];

      const { response, json } = await batchRemovePosts(entries);
      assertValidResponse(response);

      expect(json.results).toHaveLength(1);
      expect(json.results![0].results).toHaveLength(3);
      expect(json.results![0].results[0].status).toBe('removed');
      expect(json.results![0].results[0].uri).toBe(dummyPost1.uri);
      expect(json.results![0].results[1].status).toBe('error');
      expect(json.results![0].results[1].uri).toBe(dummyPost2.uri);
      expect(json.results![0].results[1].error).toBe('Post not found in feed');
      expect(json.results![0].results[2].status).toBe('removed');
      expect(json.results![0].results[2].uri).toBe(dummyPost3.uri);

      expect(await verifyPostExists(dummyPost1.uri)).toBe(false);
      expect(await verifyPostExists(dummyPost3.uri)).toBe(false);
    });

    it('Given all feeds are missing When batch remove is called Then all posts return errors', async () => {
      const nonExistentFeed = 'at://did:plc:nonexistent/app.bsky.feed.generator/fake';

      const entries = [
        {
          feed: nonExistentFeed,
          posts: [
            { uri: dummyPost1.uri, indexedAt: dummyPost1.indexedAt },
            { uri: dummyPost2.uri, indexedAt: dummyPost2.indexedAt },
          ],
        },
      ];

      const { response, json } = await batchRemovePosts(entries);
      assertValidResponse(response);

      expect(json.results).toHaveLength(1);
      expect(json.results![0].results).toHaveLength(2);
      expect(json.results![0].results[0].status).toBe('error');
      expect(json.results![0].results[1].status).toBe('error');
    });

    it('Given indexedAt does not match existing post When batch remove is called Then post-not-found error is returned', async () => {
      const feedId1 = await insertFeed(dummyFeed1);
      await insertPost(feedId1, dummyPost1);

      const wrongDate = new Date();
      wrongDate.setFullYear(wrongDate.getFullYear() - 1);

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [{ uri: dummyPost1.uri, indexedAt: wrongDate.toISOString() }],
        },
      ];

      const { response, json } = await batchRemovePosts(entries);
      assertValidResponse(response);

      expect(json.results![0].results[0].status).toBe('error');
      expect(json.results![0].results[0].error).toBe('Post not found in feed');
      expect(await verifyPostExists(dummyPost1.uri, dummyPost1.indexedAt)).toBe(true);
    });

    it('Given feed URI format is invalid When batch remove is called Then it returns 400', async () => {
      const entries = [
        {
          feed: 'invalid-uri',
          posts: [{ uri: dummyPost1.uri }],
        },
      ];

      const { response, json } = await batchRemovePosts(entries);
      expect(response.status).toBe(400);
      expect(json.error).toBe('BadRequest');
    });

    it('Given post URI format is invalid When batch remove is called Then it returns 400', async () => {
      await insertFeed(dummyFeed1);

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [{ uri: 'invalid-uri' }],
        },
      ];

      const { response, json } = await batchRemovePosts(entries);
      expect(response.status).toBe(400);
      expect(json.error).toBe('BadRequest');
    });

    it('Given a DB exception occurs during batch delete When batch remove is called Then corresponding posts are marked as error', async () => {
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
              if (query.includes('SELECT uri, indexed_at FROM posts')) {
                return {
                  success: true,
                  results: [{ uri: dummyPost1.uri, indexed_at: dummyPost1.indexedAt }],
                };
              }
              return { success: true, results: [] };
            },
            run: async () => ({ success: true, meta: { changed_db: 1 } }),
          }),
        }),
        batch: async () => {
          throw new Error('Batch delete failed');
        },
      };

      const mockEnv: Partial<Env> = { DB: mockDb as unknown as D1Database };

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [{ uri: dummyPost1.uri, indexedAt: dummyPost1.indexedAt }],
        },
      ];

      const { response, json } = await batchRemovePosts(entries, mockEnv);

      expect(response.status).toBe(200);
      expect(json.results).toBeDefined();
      expect(json.results![0].results[0].status).toBe('error');
      expect(json.results![0].results[0].error).toBe('Failed to remove post from DB');
    });

    it('Given feed query result has success=false When batch remove is called Then it returns 500', async () => {
      const mockDb = {
        prepare: (_query: string) => ({
          bind: (..._args: any[]) => ({
            all: async () => ({
              success: false,
              results: [],
            }),
            run: async () => ({ success: true, meta: { changed_db: 0 } }),
          }),
        }),
        batch: async () => [],
      };

      const mockEnv: Partial<Env> = { DB: mockDb as unknown as D1Database };

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [{ uri: dummyPost1.uri, indexedAt: dummyPost1.indexedAt }],
        },
      ];

      const { response, json } = await batchRemovePosts(entries, mockEnv);

      expect(response.status).toBe(500);
      assertErrorResponse(json);
      expect(json.error).toBe('InternalServerError');
      expect(json.message).toContain('Failed to query feeds');
    });

    it('Given existing-post check result has success=false When batch remove is called Then all target posts are marked as error', async () => {
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
              if (query.includes('SELECT uri, indexed_at FROM posts')) {
                return {
                  success: false,
                  results: [],
                };
              }
              return { success: true, results: [] };
            },
            run: async () => ({ success: true, meta: { changed_db: 0 } }),
          }),
        }),
        batch: async () => [],
      };

      const mockEnv: Partial<Env> = { DB: mockDb as unknown as D1Database };

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [
            { uri: dummyPost1.uri, indexedAt: dummyPost1.indexedAt },
            { uri: dummyPost2.uri, indexedAt: dummyPost2.indexedAt },
          ],
        },
      ];

      const { response, json } = await batchRemovePosts(entries, mockEnv);

      expect(response.status).toBe(200);
      expect(json.results).toBeDefined();
      expect(json.results![0].results).toHaveLength(2);
      expect(json.results![0].results[0].status).toBe('error');
      expect(json.results![0].results[0].error).toBe('Failed to check post existence');
      expect(json.results![0].results[1].status).toBe('error');
      expect(json.results![0].results[1].error).toBe('Failed to check post existence');
    });

    it('Given DB batch delete results contain failed items When batch remove is called Then corresponding posts are marked as error', async () => {
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
              if (query.includes('SELECT uri, indexed_at FROM posts')) {
                return {
                  success: true,
                  results: [{ uri: dummyPost1.uri, indexed_at: dummyPost1.indexedAt }],
                };
              }
              return { success: true, results: [] };
            },
            run: async () => ({ success: true, meta: { changed_db: 0 } }),
          }),
        }),
        batch: async () => [{ success: false }],
      };

      const mockEnv: Partial<Env> = { DB: mockDb as unknown as D1Database };

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [{ uri: dummyPost1.uri, indexedAt: dummyPost1.indexedAt }],
        },
      ];

      const { response, json } = await batchRemovePosts(entries, mockEnv);

      expect(response.status).toBe(200);
      expect(json.results).toBeDefined();
      expect(json.results![0].results[0].status).toBe('error');
      expect(json.results![0].results[0].error).toBe('Failed to remove post from DB');
    });
  });
});
