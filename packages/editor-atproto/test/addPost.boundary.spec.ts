import { beforeEach, describe, expect, it } from 'vitest';

import { addPost, dummyPost, ENDPOINT_PATH, resetFeedTables } from './addPost.shared';
import { countPostsByUriInFeed, FEED_URI, insertFeed } from './feedTest.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetFeedTables();
  });

  describe('Boundary cases', () => {
    it('Given languages are omitted When addPost is called Then default language marker is used', async () => {
      await insertFeed(FEED_URI);

      const { response, json } = await addPost({
        feed: FEED_URI,
        post: {
          uri: dummyPost.uri,
          cid: dummyPost.cid,
        },
      });

      expect(response.status).toBe(200);
      expect((json as { post: { languages: string[] } }).post.languages).toEqual(['*']);
      expect(await countPostsByUriInFeed(FEED_URI, dummyPost.uri)).toBe(1);
    });
  });
});
