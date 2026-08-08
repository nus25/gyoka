import { beforeEach, describe, expect, it } from 'vitest';

import { addPost, dummyPost, ENDPOINT_PATH, resetFeedTables } from './addPost.shared';
import { countPostsByUriInFeed, FEED_URI, insertFeed } from './feedTest.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetFeedTables();
  });

  describe('Success cases', () => {
    it('Given existing feed When addPost is called Then post is added', async () => {
      await insertFeed(FEED_URI);

      const { response, json } = await addPost({
        feed: FEED_URI,
        post: { ...dummyPost },
      });

      expect(response.status).toBe(200);
      expect((json as { message: string }).message).toBe('Post added successfully');
      expect(await countPostsByUriInFeed(FEED_URI, dummyPost.uri)).toBe(1);
    });
  });
});
