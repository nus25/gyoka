import { beforeEach, describe, expect, it } from 'vitest';

import {
  countPostsByFeedUri,
  FEED_URI,
  insertFeed,
  insertPost,
  POST_URI,
  POST_URI_2,
} from './feedTest.shared';
import { ENDPOINT_PATH, resetFeedTables, trimFeedBefore } from './trimFeedBefore.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetFeedTables();
  });

  describe('Success cases', () => {
    it('Given feed has posts before, at, and after the boundary When trimFeedBefore is called Then only posts before the boundary are removed', async () => {
      const { feedId } = await insertFeed(FEED_URI);
      await insertPost(feedId, { uri: POST_URI, indexedAt: '2025-01-01T00:00:00.000Z' });
      await insertPost(feedId, { uri: POST_URI_2, indexedAt: '2025-01-02T00:00:00.000Z' });
      await insertPost(feedId, {
        uri: 'at://did:plc:testuser/app.bsky.feed.post/post3',
        indexedAt: '2025-01-03T00:00:00.000Z',
      });

      const { response, json } = await trimFeedBefore({
        feed: FEED_URI,
        before: '2025-01-02T00:00:00.000Z',
      });

      expect(response.status).toBe(200);
      expect(json).toEqual({
        message: 'Posts before timestamp trimmed successfully',
        feed: FEED_URI,
        before: '2025-01-02T00:00:00.000Z',
        deletedCount: 1,
      });

      expect(await countPostsByFeedUri(FEED_URI)).toBe(2);
    });
  });
});