import { describe, it, expect, beforeEach } from 'vitest';

import {
  ENDPOINT_PATH,
  author1Did,
  countPostLanguagesByPostId,
  dummyFeed,
  dummyPosts,
  insertFeed,
  insertPost,
  removePostByAuthor,
  resetRemovePostByAuthorTables,
} from './removePostByAuthor.shared';
import { assertErrorResponse } from './testUtils';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetRemovePostByAuthorTables();
  });

  describe('Error cases', () => {
    it('Given feed does not exist When remove by author is called Then it returns unknown feed', async () => {
      const { response, json } = await removePostByAuthor(
        'at://did:plc:nonexistent/app.bsky.feed.generator/feed',
        author1Did
      );
      expect(response.status).toBe(404);
      assertErrorResponse(json);
      expect(json.error).toBe('UnknownFeed');
    });

    it('Given feed URI is invalid When remove by author is called Then it returns bad request', async () => {
      const { response, json } = await removePostByAuthor('invalid-uri', author1Did);
      expect(response.status).toBe(400);
      assertErrorResponse(json);
      expect(json.error).toBe('BadRequest');
    });

    it('Given author DID is invalid When remove by author is called Then it returns bad request', async () => {
      const feedId = await insertFeed(dummyFeed);
      await insertPost(feedId, dummyPosts[0]);
      expect(await countPostLanguagesByPostId(dummyPosts[0].id)).toBeGreaterThan(0);

      const { response, json } = await removePostByAuthor(dummyFeed.uri, 'invalid-did');
      expect(response.status).toBe(400);
      assertErrorResponse(json);
      expect(json.error).toBe('BadRequest');
      expect(await countPostLanguagesByPostId(dummyPosts[0].id)).toBeGreaterThan(0);
    });

    it('Given feed query throws exception When remove by author is called Then it returns internal server error', async () => {
      const mockDb = {
        prepare: (query: string) => {
          if (query.includes('SELECT')) {
            return {
              bind: () => ({
                all: async () => {
                  throw new Error('SQLITE_ERROR: no such table: posts');
                },
              }),
            };
          }

          return {
            bind: () => ({
              run: async () => ({ success: true, meta: { changes: 0 } }),
            }),
          };
        },
      };

      const { response } = await removePostByAuthor(dummyFeed.uri, author1Did, {
        DB: mockDb as unknown as D1Database,
      });
      expect(response.status).toBe(500);
    });

    it('Given feed existence query fails When remove by author is called Then it returns internal server error', async () => {
      const mockDb = {
        prepare: (query: string) => {
          if (query.includes('SELECT')) {
            return {
              bind: () => ({
                all: async () => ({ success: false, results: [] }),
              }),
            };
          }
          return {
            bind: () => ({
              run: async () => ({ success: true, meta: { changes: 0 } }),
            }),
          };
        },
      };

      const { response, json } = await removePostByAuthor(dummyFeed.uri, author1Did, {
        DB: mockDb as unknown as D1Database,
      });

      expect(response.status).toBe(500);
      assertErrorResponse(json);
      expect(json.error).toBe('InternalServerError');
      expect(json.message).toContain('Failed to query the database');
    });

    it('Given delete operation fails When remove by author is called Then it returns internal server error', async () => {
      const mockDb = {
        prepare: (query: string) => {
          if (query.includes('SELECT')) {
            return {
              bind: () => ({
                all: async () => ({
                  success: true,
                  results: [{ feed_id: 1 }],
                }),
              }),
            };
          }
          if (query.includes('DELETE')) {
            return {
              bind: () => ({
                run: async () => ({ success: false }),
              }),
            };
          }
          return {
            bind: () => ({}),
          };
        },
      };

      const { response, json } = await removePostByAuthor(dummyFeed.uri, author1Did, {
        DB: mockDb as unknown as D1Database,
      });

      expect(response.status).toBe(500);
      assertErrorResponse(json);
      expect(json.error).toBe('InternalServerError');
      expect(json.message).toContain('Failed to remove posts from the database');
    });
  });
});
