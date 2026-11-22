import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { getFeedAndPlacementBounds } from '../src/endpoints/postMutation.shared';
import {
  FEED_URI,
  POST_URI,
  POST_URI_2,
  insertFeed,
  insertPost,
  resetFeedTables,
} from './feedTest.shared';

const POST_URI_3 = 'at://did:plc:testuser/app.bsky.feed.post/post3';

describe('postMutation.shared', () => {
  beforeEach(resetFeedTables);

  it('Given a replaced post before an anchor When getting placement bounds Then it excludes the replaced post', async () => {
    const { feedId } = await insertFeed(FEED_URI);
    await insertPost(feedId, { uri: POST_URI, orderRank: 'a0' });
    await insertPost(feedId, { uri: POST_URI_2, orderRank: 'a1' });
    await insertPost(feedId, { uri: POST_URI_3, orderRank: 'a2' });

    await expect(
      getFeedAndPlacementBounds(env.DB, FEED_URI, { position: 'before', anchor: POST_URI_3 }, [
        POST_URI_2,
      ])
    ).resolves.toMatchObject({
      feed: { feed_id: feedId, order_revision: 0 },
      lower: 'a0',
      upper: 'a2',
    });
  });
});
