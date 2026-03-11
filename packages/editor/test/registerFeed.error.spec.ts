import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';

import { ENDPOINT_PATH, registerFeed, resetRegisterFeedTables } from './registerFeed.shared';
import { assertErrorResponse } from './testUtils';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetRegisterFeedTables();
  });

  describe('Error cases', () => {
    it('Given feed is already registered When register feed is called Then it returns conflict', async () => {
      const feed = { uri: 'at://did:plc:testuser/app.bsky.feed.generator/feed3', isActive: true };
      await registerFeed(feed);
      const { response, json } = await registerFeed(feed);
      expect(response.status).toBe(409);
      expect(json).toEqual({
        error: 'Conflict',
        message: `Feed with URI ${feed.uri} already exists.`,
      });
    });

    it('Given feed URI is invalid When register feed is called Then it returns bad request', async () => {
      const feed = { uri: 'invalid-uri', isActive: true };
      const { response, json } = await registerFeed(feed);
      expect(response.status).toBe(400);
      assertErrorResponse(json);
      expect(json.error).toBe('BadRequest');
      expect(json.message).toBeDefined();
    });

    it('Given database schema is broken When register feed is called Then it returns internal server error', async () => {
      const db = env.DB;
      await db.prepare('DROP TABLE feeds').run();
      const feed = { uri: 'at://did:plc:testuser/app.bsky.feed.generator/feed4', isActive: true };
      const { response, json } = await registerFeed(feed);
      expect(response.status).toBe(500);
      expect(json).toEqual({
        error: 'InternalServerError',
        message: 'An unexpected error occurred.',
      });
    });

    it('Given database operation reports failure When register feed is called Then it returns internal server error', async () => {
      const mockDb = {
        prepare: () => ({
          bind: () => ({
            run: async () => ({ success: false }),
          }),
        }),
      };

      const feed = { uri: 'at://did:plc:testuser/app.bsky.feed.generator/feed5', isActive: true };
      const { response, json } = await registerFeed(feed, {
        DB: mockDb as unknown as D1Database,
      });
      expect(response.status).toBe(500);
      expect(json).toEqual({
        error: 'InternalServerError',
        message: 'Failed to register feed',
      });
    });
  });
});
