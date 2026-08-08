import { beforeEach, describe, expect, it } from 'vitest';

import {
  countPostsByFeedUri,
  FEED_URI,
  insertFeed,
  insertPost,
  POST_URI,
  POST_URI_2,
} from './feedTest.shared';
import { ENDPOINT_PATH, resetFeedTables, trimFeed } from './trimFeed.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetFeedTables();
  });

  describe('Success cases', () => {
    it('Given feed has multiple posts When trimFeed is called Then extra posts are removed', async () => {
      const { feedId } = await insertFeed(FEED_URI);
      await insertPost(feedId, { uri: POST_URI, indexedAt: '2025-01-01T00:00:00.000Z' });
      await insertPost(feedId, { uri: POST_URI_2, indexedAt: '2025-01-02T00:00:00.000Z' });

      const { response, json } = await trimFeed({ feed: FEED_URI, remain: 1 });

      expect(response.status).toBe(200);
      expect(json).toEqual({
        message: 'Posts trimed successfully',
        feed: FEED_URI,
        deletedCount: 1,
      });

      expect(await countPostsByFeedUri(FEED_URI)).toBe(1);
    });
  });
});
