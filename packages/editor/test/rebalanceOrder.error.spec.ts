import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { TEST_CID, FEED_URI, insertFeed, resetFeedTables, callProcedure } from './feedTest.shared';
import { REBALANCE_PATH } from './postMutation.shared';

describe('rebalanceOrder', () => {
  beforeEach(resetFeedTables);

  it('Given an unknown feed, when rebalancing, then returns unknown feed', async () => {
    const { response, json } = await callProcedure(REBALANCE_PATH, {
      feed: FEED_URI,
      expectedRevision: 0,
    });

    expect(response.status).toBe(404);
    expect(json).toEqual({
      error: 'UnknownFeed',
      message: `Feed with URI ${FEED_URI} does not exist.`,
    });
  });

  it('Given an empty feed, when rebalancing, then returns a no-op', async () => {
    await insertFeed(FEED_URI);

    const { response, json } = await callProcedure(REBALANCE_PATH, {
      feed: FEED_URI,
      expectedRevision: 0,
    });

    expect(response.status).toBe(200);
    expect(json).toEqual({
      feed: FEED_URI,
      orderRevision: 0,
      postCount: 0,
    });
  });

  it('Given a stale expected revision, when rebalancing, then returns revision conflict', async () => {
    await insertFeed(FEED_URI, 1, 1, 2);

    const { response, json } = await callProcedure(REBALANCE_PATH, {
      feed: FEED_URI,
      expectedRevision: 1,
    });

    expect(response.status).toBe(409);
    expect(json).toEqual({
      error: 'RevisionConflict',
      message: 'The feed revision changed.',
    });
  });

  it('Given a feed above 2000 posts, when rebalancing, then returns too large', async () => {
    const { feedId } = await insertFeed(FEED_URI);
    const indexedAt = new Date().toISOString();
    const posts = Array.from({ length: 2_001 }, (_, index) => [
      feedId,
      `at://did:plc:author/app.bsky.feed.post/${index.toString().padStart(4, '0')}`,
      TEST_CID,
      indexedAt,
      `a${index.toString().padStart(4, '0')}U`,
    ]);
    for (let index = 0; index < posts.length; index += 20) {
      const batch = posts.slice(index, index + 20);
      await env.DB.prepare(
        `INSERT INTO posts (feed_id, uri, cid, indexed_at, order_rank) VALUES ${batch
          .map(() => '(?, ?, ?, ?, ?)')
          .join(', ')}`
      )
        .bind(...batch.flat())
        .run();
    }

    const { response, json } = await callProcedure(REBALANCE_PATH, {
      feed: FEED_URI,
      expectedRevision: 0,
    });

    expect(response.status).toBe(400);
    expect(json).toEqual({
      error: 'RebalanceTooLarge',
      message: 'The feed exceeds MAX_REBALANCE_POSTS.',
    });
  });
});
