import { beforeEach, describe, expect, it } from 'vitest';

import { ENDPOINT_PATH, getFeedList, resetListFeedsTable } from './listFeeds.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetListFeedsTable();
  });

  describe('Error cases', () => {
    it('Given feed query reports failure When list feeds is called Then it returns internal server error', async () => {
      const failingDb = {
        prepare: () => ({
          all: async () => ({ success: false, meta: {}, error: 'Database error' }),
        }),
      } as unknown as D1Database;

      const { response, json } = await getFeedList({ DB: failingDb });

      expect(response.status).toBe(500);
      expect(json).toEqual({
        error: 'InternalServerError',
        message: 'Failed to fetch feeds',
      });
    });

    it('Given feed query throws exception When list feeds is called Then it returns internal server error', async () => {
      const throwingDb = {
        prepare: () => ({
          all: async () => {
            throw new Error('SQLITE_ERROR: no such table: feeds');
          },
        }),
      } as unknown as D1Database;

      const { response, json } = await getFeedList({ DB: throwingDb });

      expect(response.status).toBe(500);
      expect(json).toEqual({
        error: 'InternalServerError',
        message: 'Failed to fetch feeds',
      });
    });
  });
});
