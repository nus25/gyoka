import { beforeEach, describe, expect, it } from 'vitest';

import { addPost, dummyPost, ENDPOINT_PATH, resetFeedTables } from './addPost.shared';
import { countPostsByUriInFeed, FEED_URI } from './feedTest.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetFeedTables();
  });

  describe('Error cases', () => {
    it('Given feed does not exist When addPost is called Then unknown feed is returned', async () => {
      const { response, json } = await addPost({
        feed: FEED_URI,
        post: { ...dummyPost },
      });

      expect(response.status).toBe(404);
      expect((json as { error: string }).error).toBe('UnknownFeed');
      expect(await countPostsByUriInFeed(FEED_URI, dummyPost.uri)).toBe(0);
    });
  });
});
