import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';

import { assertErrorResponse } from './testUtils';
import {
  DEFAULT_FEED_URI,
  ENDPOINT_PATH,
  seedDefaultFeed,
  unregisterFeed,
} from './unregisterFeed.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await seedDefaultFeed();
  });

  describe('Error cases', () => {
    it('Given feed does not exist When unregister feed is called Then it returns unknown feed', async () => {
      const feedUri = 'at://did:plc:testuser/app.bsky.feed.generator/nonexistent';
      const { response, json } = await unregisterFeed(feedUri);
      expect(response.status).toBe(404);
      assertErrorResponse(json);
      expect(json.error).toBe('UnknownFeed');
      expect(json.message).toContain('does not exist');
      expect(json.message).toContain(feedUri);
    });

    it('Given feed URI is invalid When unregister feed is called Then it returns bad request', async () => {
      const { response, json } = await unregisterFeed('invalid-uri');
      expect(response.status).toBe(400);
      assertErrorResponse(json);
      expect(json.error).toBe('BadRequest');
      expect(json.message).toBeDefined();
    });

    it('Given database schema is broken When unregister feed is called Then it returns internal server error', async () => {
      const db = env.DB;
      await db.prepare('DROP TABLE feeds').run();

      const { response, json } = await unregisterFeed(DEFAULT_FEED_URI);
      expect(response.status).toBe(500);
      assertErrorResponse(json);
      expect(json.error).toBe('InternalServerError');
      expect(json.message).toBeDefined();
    });

    it('Given feed existence query fails When unregister feed is called Then it returns internal server error', async () => {
      const mockDb = {
        prepare: () => ({
          bind: () => ({
            all: async () => ({ success: false, results: [] }),
          }),
        }),
      };

      const { response, json } = await unregisterFeed(DEFAULT_FEED_URI, {
        DB: mockDb as unknown as D1Database,
      });
      expect(response.status).toBe(500);
      assertErrorResponse(json);
      expect(json.error).toBe('InternalServerError');
      expect(json.message).toContain('Failed to query the database');
    });

    it('Given batch operation fails When unregister feed is called Then it returns internal server error', async () => {
      const mockDb = {
        prepare: (query: string) => {
          if (query.includes('SELECT')) {
            return {
              bind: () => ({
                all: async () => ({
                  success: true,
                  results: [
                    {
                      feed_id: 1,
                      feed_uri: DEFAULT_FEED_URI,
                      is_active: 1,
                    },
                  ],
                }),
              }),
            };
          }
          return {
            bind: () => ({}),
          };
        },
        batch: async () => [{ success: false }],
      };

      const { response, json } = await unregisterFeed(DEFAULT_FEED_URI, {
        DB: mockDb as unknown as D1Database,
      });
      expect(response.status).toBe(500);
      assertErrorResponse(json);
      expect(json.error).toBe('InternalServerError');
      expect(json.message).toContain('Failed to unregister feed and associated posts');
    });
  });
});
