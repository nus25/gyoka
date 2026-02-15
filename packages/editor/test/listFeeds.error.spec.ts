import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ENDPOINT_PATH,
  getFeedList,
  resetListFeedsTable,
} from './listFeeds.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetListFeedsTable();
  });

  describe('Error cases', () => {
    it('Given database schema is broken When list feeds is called Then it returns internal server error', async () => {
      const db = env.DB;
      await db.prepare('DROP TABLE feeds').run();

      const { response } = await getFeedList();
      expect(response.status).toBe(500);
    });

    it('Given feed query reports failure When list feeds is called Then it returns internal server error', async () => {
      const failingDb = {
        prepare: () => ({
          all: async () => ({ success: false, meta: {}, error: 'Database error' }),
        }),
      } as unknown as D1Database;

      const failingEnv: Partial<Env> = {
        DB: failingDb,
      };

      const { response, json } = await getFeedList(failingEnv);

      expect(response.status).toBe(500);
      expect(json).toEqual({
        error: 'InternalServerError',
        message: 'Failed to fetch feeds',
      });
    });
  });
});
