import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { assertErrorResponse } from './testUtils';
import {
  ENDPOINT_PATH,
  dummyFeed,
  dummyPost,
  insertFeed,
  insertPost,
  removePost,
  resetRemovePostTables,
  verifyPostLanguagesExist,
} from './removePost.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetRemovePostTables();
  });

  describe('Error cases', () => {
    it('Given feed does not exist When remove is called Then it returns not found', async () => {
      const feedUri = 'at://did:plc:nonexistent/app.bsky.feed.generator/feed';
      const { response, json } = await removePost(feedUri, {
        uri: dummyPost.uri,
      });
      expect(response.status).toBe(404);
      assertErrorResponse(json);
      expect(json.error).toBe('NotFound');
      expect(json.message).toContain('does not exist');
      expect(json.message).toContain(feedUri);
    });

    it('Given post does not exist in feed When remove is called Then it returns not found', async () => {
      await insertFeed(dummyFeed);
      const postUri = 'at://did:plc:testuser/app.bsky.feed.post/nonexistent';

      const { response, json } = await removePost(dummyFeed.uri, {
        uri: postUri,
      });
      expect(response.status).toBe(404);
      assertErrorResponse(json);
      expect(json.error).toBe('NotFound');
      expect(json.message).toContain('Post not found');
      expect(json.message).toContain(dummyFeed.uri);
      expect(json.message).toContain(postUri);
    });

    it('Given feed URI is invalid When remove is called Then it returns bad request', async () => {
      const { response } = await removePost('invalid-uri', { uri: dummyPost.uri });
      expect(response.status).toBe(400);
    });

    it('Given post URI is invalid When remove is called Then it returns bad request', async () => {
      const feedId = await insertFeed(dummyFeed);
      await insertPost(feedId, dummyPost);
      expect(await verifyPostLanguagesExist(dummyPost.id)).toBe(true);

      const { response } = await removePost(dummyFeed.uri, { uri: 'invalid-uri' });
      expect(response.status).toBe(400);
      expect(await verifyPostLanguagesExist(dummyPost.id)).toBe(true);
    });

    it('Given database schema is broken When remove is called Then it returns internal server error', async () => {
      await insertFeed(dummyFeed);
      const db = env.DB;
      await db.prepare('DROP TABLE posts').run();

      const { response } = await removePost(dummyFeed.uri, { uri: dummyPost.uri });
      expect(response.status).toBe(500);
    });

    it('Given feed existence query fails When remove is called Then it returns internal server error', async () => {
      const mockDb = {
        prepare: (query: string) => {
          if (query.includes('DELETE')) {
            return {
              bind: () => ({
                run: async () => ({ success: true, meta: { changed_db: false } }),
              }),
            };
          }
          if (query.includes('SELECT')) {
            return {
              bind: () => ({
                all: async () => ({ success: false, results: [] }),
              }),
            };
          }
          return {
            bind: () => ({}),
          };
        },
      };

      const { response, json } = await removePost(
        dummyFeed.uri,
        { uri: dummyPost.uri },
        {
          DB: mockDb as unknown as D1Database,
        }
      );

      expect(response.status).toBe(500);
      assertErrorResponse(json);
      expect(json.error).toBe('InternalServerError');
      expect(json.message).toContain('Failed to query the database');
    });

    it('Given delete operation fails When remove is called Then it returns internal server error', async () => {
      const mockDb = {
        prepare: (query: string) => {
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

      const { response, json } = await removePost(
        dummyFeed.uri,
        { uri: dummyPost.uri },
        {
          DB: mockDb as unknown as D1Database,
        }
      );

      expect(response.status).toBe(500);
      assertErrorResponse(json);
      expect(json.error).toBe('InternalServerError');
      expect(json.message).toContain('Failed to remove post from the database');
    });
  });
});
