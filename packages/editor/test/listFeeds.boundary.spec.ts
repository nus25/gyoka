import { describe, it, expect, beforeEach } from 'vitest';
import {
  assertValidResponse,
  ENDPOINT_PATH,
  getFeedList,
  resetListFeedsTable,
} from './listFeeds.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetListFeedsTable();
  });

  describe('Boundary cases', () => {
    it('Given no feeds exist When list feeds is called Then it returns an empty feed list', async () => {
      const { response, json } = await getFeedList();
      assertValidResponse(response);
      expect(json).toEqual({
        feeds: [],
      });
    });
  });
});
