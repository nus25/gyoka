import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { listFeeds } from '../src/endpoints/listFeeds';
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
    it('Given no feeds When listing feeds Then diagnostic context records zero results', async () => {
      const context: Record<string, unknown> = {};
      const response = await listFeeds(env.DB, context);
      expect(response.status).toBe(200);
      expect(context).toMatchObject({ resultCount: 0 });
    });

    it('Given no feeds exist When list feeds is called Then an empty array is returned', async () => {
      const { response, json } = await getFeedList();
      assertValidResponse(response);
      expect(json).toEqual({
        feeds: [],
      });
    });
    it('Given multiple feeds exist When list feeds is called Then all feeds are returned with mapped flags', async () => {
      await insertFeeds(dummyFeeds);

      const { response, json } = await getFeedList();
      assertValidResponse(response);
      expect(json).toEqual({
        feeds: expect.arrayContaining([
          {
            uri: dummyFeeds[0].uri,
            langFilter: true,
            isActive: true,
            orderRevision: 0,
          },
          {
            uri: dummyFeeds[1].uri,
            langFilter: true,
            isActive: false,
            orderRevision: 3,
          },
          {
            uri: dummyFeeds[2].uri,
            langFilter: false,
            isActive: true,
            orderRevision: 0,
          },
        ]),
      });
    });
  });
});
