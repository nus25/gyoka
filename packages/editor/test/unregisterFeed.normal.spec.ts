import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { unregisterFeed as unregisterFeedEndpoint } from '../src/endpoints/unregisterFeed';
import { countFeedRowsByUri, countPostsByFeedUri, FEED_URI, insertFeed } from './feedTest.shared';
import { ENDPOINT_PATH, resetFeedTables, unregisterFeed } from './unregisterFeed.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetFeedTables();
  });

  describe('Success cases', () => {
    it('Given an existing feed When unregistering it Then diagnostic context records write counts', async () => {
      await insertFeed(FEED_URI);
      const context: Record<string, unknown> = {};
      const response = await unregisterFeedEndpoint(env.DB, { uri: FEED_URI }, context);
      expect(response.status).toBe(200);
      expect(context).toMatchObject({ feed: FEED_URI, deletedCount: 0 });
    });

    it('Given existing feed When unregisterFeed is called Then feed is removed', async () => {
      await insertFeed(FEED_URI, 1, 1);

      const { response, json } = await unregisterFeed({ uri: FEED_URI });

      expect(response.status).toBe(200);
      expect(json).toEqual({
        message: 'Feed unregistered successfully',
      });

      expect(await countFeedRowsByUri(FEED_URI)).toBe(0);
      expect(await countPostsByFeedUri(FEED_URI)).toBe(0);
    });
  });
});
