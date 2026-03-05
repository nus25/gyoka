import { describe, it, expect, beforeEach } from 'vitest';

import {
  ENDPOINT_PATH,
  assertGetPostsResponse,
  dummyFeed,
  getPosts,
  insertFeed,
  insertPost,
  resetGetPostsTables,
} from './getPosts.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetGetPostsTables();
  });

  describe('Boundary cases', () => {
    it('Given custom limit is set When get posts is called Then the number of returned posts respects the limit', async () => {
      const feedId = await insertFeed(dummyFeed);
      const posts = Array.from({ length: 5 }, (_, i) => ({
        id: i,
        uri: `at://did:plc:testuser/app.bsky.post/test-${i}`,
        cid: `cid-${i}`,
        indexedAt: new Date(2024, 0, i + 1).toISOString(),
        langs: ['en'],
      }));

      for (const post of posts) {
        await insertPost(feedId, post);
      }

      const { json } = await getPosts(dummyFeed.uri, 3);
      assertGetPostsResponse(json);
      expect(json.posts).toHaveLength(3);
    });
  });
});
