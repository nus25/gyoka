import { beforeEach, describe, expect, it } from 'vitest';

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
    it('Given no feeds exist When list feeds is called Then an empty list is returned', async () => {
      const { response, json } = await getFeedList();

      assertValidResponse(response);
      expect(json).toEqual({
        feeds: [],
      });
    });
  });
});
