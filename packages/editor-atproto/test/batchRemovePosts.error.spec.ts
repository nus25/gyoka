import { beforeEach, describe, expect, it } from 'vitest';

import {
  batchRemovePosts,
  dummyEntries,
  ENDPOINT_PATH,
  resetFeedTables,
} from './batchRemovePosts.shared';
import { countPostsByFeedUri, FEED_URI } from './feedTest.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetFeedTables();
  });

  describe('Error cases', () => {
    it('Given max batch size is exceeded When batchRemovePosts is called Then bad request is returned', async () => {
      const { response, json } = await batchRemovePosts(
        {
          entries: dummyEntries,
        },
        {
          MAX_BATCH_POSTS: '1',
        }
      );

      expect(response.status).toBe(400);
      expect(json).toEqual({
        error: 'BadRequest',
        message: 'Maximum 1 posts allowed per request. Received 2 posts.',
      });

      expect(await countPostsByFeedUri(FEED_URI)).toBe(0);
    });
  });
});
