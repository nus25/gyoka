import { beforeEach, describe, expect, it } from 'vitest';

import {
  batchAddPosts,
  dummyEntries,
  ENDPOINT_PATH,
  resetFeedTables,
} from './batchAddPosts.shared';
import { countPostsByFeedUri, FEED_URI } from './feedTest.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetFeedTables();
  });

  describe('Error cases', () => {
    it('Given max batch size is exceeded When batchAddPosts is called Then bad request is returned', async () => {
      const { response, json } = await batchAddPosts(
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
    it('Given invalid repost reason When batchAddPosts is called Then error is returned', async () => {
      const { response, json } = await batchAddPosts(
        {
          entries: [
            {
              feed: FEED_URI,
              posts: [
                {
                  ...dummyEntries[0].posts[0],
                  reason: {
                    $type: 'net.nusno.gyoka.feed.batchAddPosts#skeletonReasonRepost',
                    repost: 'at://did:plc:invaliduser/app.bsky.feed.notrepost/invalid',
                  },
                },
              ],
            },
          ],
        },
        {
          MAX_BATCH_POSTS: '10',
        }
      );

      expect(response.status).toBe(200);
      expect(json).toEqual({
        results: [
          {
            feed: 'at://did:plc:testuser/app.bsky.feed.generator/feed1',
            results: [
              {
                error:
                  'Feed with URI at://did:plc:testuser/app.bsky.feed.generator/feed1 does not exist.',
                status: 'error',
                uri: 'at://did:plc:testuser/app.bsky.feed.post/post1',
              },
            ],
          },
        ],
      });
      expect(await countPostsByFeedUri(FEED_URI)).toBe(0);
    });
  });
});
