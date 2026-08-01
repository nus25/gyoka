import { beforeEach, describe, expect, it } from 'vitest';

import {
  batchRemovePosts,
  dummyEntries,
  ENDPOINT_PATH,
  resetFeedTables,
} from './batchRemovePosts.shared';
import {
  countPostsByFeedUri,
  FEED_URI,
  insertFeed,
  insertPost,
  POST_URI,
  POST_URI_2,
} from './feedTest.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetFeedTables();
  });

  describe('Success cases', () => {
    it('Given posts exist in feed When batchRemovePosts is called Then posts are removed', async () => {
      const { feedId } = await insertFeed(FEED_URI);
      await insertPost(feedId, { uri: POST_URI });
      await insertPost(feedId, { uri: POST_URI_2 });

      const { response, json } = await batchRemovePosts({ entries: dummyEntries });

      expect(response.status).toBe(200);
      expect(
        (json as { results: Array<{ results: Array<{ status: string }> }> }).results[0].results
      ).toEqual([
        { uri: POST_URI, status: 'removed' },
        { uri: POST_URI_2, status: 'removed' },
      ]);

      expect(await countPostsByFeedUri(FEED_URI)).toBe(0);
    });
  });
});
