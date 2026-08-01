import { beforeEach, describe, expect, it } from 'vitest';

import {
  batchAddPosts,
  dummyEntries,
  ENDPOINT_PATH,
  resetFeedTables,
} from './batchAddPosts.shared';
import { countPostsByFeedUri, FEED_URI, insertFeed } from './feedTest.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetFeedTables();
  });

  describe('Success cases', () => {
    it('Given existing feed and valid posts When batchAddPosts is called Then all posts are added', async () => {
      await insertFeed(FEED_URI);

      const { response, json } = await batchAddPosts({ entries: dummyEntries });

      expect(response.status).toBe(200);
      expect(
        (json as { results: Array<{ results: Array<{ status: string }> }> }).results[0].results
      ).toEqual([
        { uri: dummyEntries[0].posts[0].uri, status: 'added' },
        { uri: dummyEntries[0].posts[1].uri, status: 'added' },
      ]);

      expect(await countPostsByFeedUri(FEED_URI)).toBe(2);
    });
  });
});
