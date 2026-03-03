import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { assertErrorResponse } from './testUtils';
import {
  ENDPOINT_PATH,
  dummyFeed,
  insertFeed,
  resetTrimFeedTables,
  trimFeed,
} from './trimFeed.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetTrimFeedTables();
  });

  describe('Error cases', () => {
    it('Given a non-existent feed When trim is called Then it returns 404', async () => {
      const { response } = await trimFeed(
        'at://did:plc:nonexistent/app.bsky.feed.generator/feed',
        5
      );
      expect(response.status).toBe(404);
    });

    it('Given an invalid feed URI When trim is called Then it returns 400', async () => {
      const { response } = await trimFeed('invalid-uri', 5);
      expect(response.status).toBe(400);
    });

    it('Given a negative remain count When trim is called Then it returns 400', async () => {
      await insertFeed(dummyFeed);
      const { response } = await trimFeed(dummyFeed.uri, -1);
      expect(response.status).toBe(400);
    });

    it('Given a database schema failure When trim is called Then it returns 500', async () => {
      await insertFeed(dummyFeed);
      const db = env.DB;
      await db.prepare('DROP TABLE posts').run();

      const { response } = await trimFeed(dummyFeed.uri, 5);
      expect(response.status).toBe(500);
    });

    it('Given feed existence query reports failure When trim is called Then it returns internal server error', async () => {
      const mockDb = {
        prepare: () => ({
          bind: () => ({
            all: async () => ({ success: false, results: [] }),
          }),
        }),
      };

      const { response, json } = await trimFeed(dummyFeed.uri, 5, {
        DB: mockDb as unknown as D1Database,
      });

      expect(response.status).toBe(500);
      assertErrorResponse(json);
      expect(json.error).toBe('InternalServerError');
      expect(json.message).toContain('Failed to query the database');
    });

    it('Given delete run reports failure When trim is called Then it returns internal server error', async () => {
      const mockEnv: Partial<Env> = {
        DB: {
          prepare: () => ({
            bind: (...bindArgs: unknown[]) => {
              if (bindArgs.length === 1) {
                return {
                  all: async () => ({
                    success: true,
                    results: [{ feed_id: 1, post_count: '5' }],
                  }),
                };
              }
              return {
                run: async () => ({ success: false }),
              };
            },
          }),
        } as unknown as D1Database,
      };

      const { response, json } = await trimFeed(dummyFeed.uri, 3, mockEnv);

      expect(response.status).toBe(500);
      assertErrorResponse(json);
      expect(json.error).toBe('InternalServerError');
      expect(json.message).toContain('Failed to remove post from the database');
    });
  });
});
