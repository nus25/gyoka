import { describe, it, expect, beforeEach } from 'vitest';
import {
  assertValidResponse,
  dummyFeeds,
  ENDPOINT_PATH,
  getFeedList,
  insertFeeds,
  resetListFeedsTable,
} from './listFeeds.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetListFeedsTable();
  });

  describe('Success cases', () => {
    it('Given multiple feeds exist When list feeds is called Then all feeds are returned with mapped flags', async () => {
      await insertFeeds(dummyFeeds);

      const { response, json } = await getFeedList();
      assertValidResponse(response);
      expect(json).toEqual({
        feeds: expect.arrayContaining([
          { uri: dummyFeeds[0].uri, langFilter: true, isActive: true },
          { uri: dummyFeeds[1].uri, langFilter: true, isActive: false },
          { uri: dummyFeeds[2].uri, langFilter: false, isActive: true },
        ]),
      });
    });
  });
});
