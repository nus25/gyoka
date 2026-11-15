import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  TEST_CID,
  FEED_URI,
  insertFeed,
  insertPost,
  resetFeedTables,
  callProcedure,
} from './feedTest.shared';
import { POST_ONE, POST_TWO, TRIM_PATH } from './postMutation.shared';

describe('trimPosts', () => {
  beforeEach(resetFeedTables);

  it('Given an empty feed When trimming in developer mode Then the no-op summary includes the result', async () => {
    await insertFeed(FEED_URI);
    const output = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const { response } = await callProcedure(
        TRIM_PATH,
        { feed: FEED_URI, remain: 1 },
        { DEVELOPER_MODE: 'enabled' }
      );
      expect(response.status).toBe(200);
      expect(output.mock.calls.map(([line]) => JSON.parse(String(line)))).toContainEqual(
        expect.objectContaining({
          event: 'feed.trim.posts.success',
          remain: 1,
          deletedCount: 0,
          orderRevision: 0,
        })
      );
    } finally {
      output.mockRestore();
    }
  });

  it('Given ranked posts in display order, when trimming to one post, then keeps only the leading post and advances the revision', async () => {
    const { feedId } = await insertFeed(FEED_URI);
    await insertPost(feedId, {
      uri: POST_ONE,
      cid: TEST_CID,
      indexedAt: '2026-01-01T00:00:00.000Z',
    });
    await insertPost(feedId, {
      uri: POST_TWO,
      cid: TEST_CID,
      indexedAt: '2026-01-02T00:00:00.000Z',
    });

    const { response, json } = await callProcedure(TRIM_PATH, {
      feed: FEED_URI,
      remain: 1,
    });

    expect(response.status).toBe(200);
    expect(json).toEqual({ feed: FEED_URI, deletedCount: 1, orderRevision: 1 });
    const rows = await env.DB.prepare('SELECT uri FROM posts WHERE feed_id = ?').bind(feedId).all();
    expect(rows.results).toEqual([{ uri: POST_TWO }]);
  });

  it('Given a feed, when trimming without an expected revision, then keeps the greatest rank and advances the revision once', async () => {
    const { feedId } = await insertFeed(FEED_URI, 1, 1, 4);
    await insertPost(feedId, { uri: POST_ONE, cid: TEST_CID, orderRank: 'a' });
    await insertPost(feedId, { uri: POST_TWO, cid: TEST_CID, orderRank: 'b' });

    const { response, json } = await callProcedure(TRIM_PATH, {
      feed: FEED_URI,
      remain: 1,
    });

    expect(response.status).toBe(200);
    expect(json).toEqual({ feed: FEED_URI, deletedCount: 1, orderRevision: 5 });
    const rows = await env.DB.prepare('SELECT uri FROM posts WHERE feed_id = ?').bind(feedId).all();
    expect(rows.results).toEqual([{ uri: POST_TWO }]);
  });

  it('Given more posts than D1 bind variables permit, when trimming to one post, then deletes the excess posts', async () => {
    const { feedId } = await insertFeed(FEED_URI);
    await env.DB.batch(
      Array.from({ length: 101 }, (_, index) =>
        env.DB.prepare(
          'INSERT INTO posts (feed_id, uri, cid, indexed_at, order_rank) VALUES (?, ?, ?, ?, ?)'
        ).bind(
          feedId,
          `at://did:plc:testuser/app.bsky.feed.post/post${index}`,
          TEST_CID,
          '2026-01-01T00:00:00.000Z',
          `rank${index}`
        )
      )
    );

    const { response, json } = await callProcedure(TRIM_PATH, {
      feed: FEED_URI,
      remain: 1,
    });

    expect(response.status).toBe(200);
    expect(json).toEqual({ feed: FEED_URI, deletedCount: 100, orderRevision: 1 });
    const rows = await env.DB.prepare('SELECT COUNT(*) AS count FROM posts WHERE feed_id = ?')
      .bind(feedId)
      .all<{ count: number }>();
    expect(rows.results).toEqual([{ count: 1 }]);
  });
});
