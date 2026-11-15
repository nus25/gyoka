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
import { POST_ONE, POST_TWO, PRUNE_BEFORE_PATH } from './postMutation.shared';

describe('prunePostsBefore', () => {
  beforeEach(resetFeedTables);

  it('Given no old posts When pruning in developer mode Then the debug summary records the normalized boundary and counts', async () => {
    await insertFeed(FEED_URI);
    const output = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const { response } = await callProcedure(
        PRUNE_BEFORE_PATH,
        {
          feed: FEED_URI,
          before: '2026-01-01T09:00:00+09:00',
        },
        { DEVELOPER_MODE: 'enabled' }
      );
      expect(response.status).toBe(200);
      const records = output.mock.calls.map(([line]) => JSON.parse(String(line)));
      expect(records).toContainEqual(
        expect.objectContaining({
          event: 'feed.prune.posts.success',
          before: '2026-01-01T00:00:00.000Z',
          candidateCount: 0,
          deletedCount: 0,
        })
      );
    } finally {
      output.mockRestore();
    }
  });

  it('Given posts on both sides of an exclusive boundary, when pruning before the boundary, then removes only older posts and normalizes the response timestamp', async () => {
    const { feedId } = await insertFeed(FEED_URI);
    await insertPost(feedId, {
      uri: POST_ONE,
      cid: TEST_CID,
      indexedAt: '2025-12-31T23:59:59.999Z',
    });
    await insertPost(feedId, {
      uri: POST_TWO,
      cid: TEST_CID,
      indexedAt: '2026-01-01T00:00:00.000Z',
    });

    const { response, json } = await callProcedure(PRUNE_BEFORE_PATH, {
      feed: FEED_URI,
      before: '2026-01-01T09:00:00+09:00',
    });

    expect(response.status).toBe(200);
    expect(json).toEqual({
      feed: FEED_URI,
      before: '2026-01-01T00:00:00.000Z',
      deletedCount: 1,
      orderRevision: 1,
    });
    const rows = await env.DB.prepare('SELECT uri FROM posts WHERE feed_id = ?').bind(feedId).all();
    expect(rows.results).toEqual([{ uri: POST_TWO }]);
  });

  it('Given a feed, when pruning matching posts without an expected revision, then advances the revision once', async () => {
    const { feedId } = await insertFeed(FEED_URI, 1, 1, 3);
    await insertPost(feedId, {
      uri: POST_ONE,
      cid: TEST_CID,
      indexedAt: '2025-12-31T00:00:00.000Z',
      orderRank: 'a',
    });

    const { response, json } = await callProcedure(PRUNE_BEFORE_PATH, {
      feed: FEED_URI,
      before: '2026-01-01T00:00:00.000Z',
    });

    expect(response.status).toBe(200);
    expect(json).toEqual({
      feed: FEED_URI,
      before: '2026-01-01T00:00:00.000Z',
      deletedCount: 1,
      orderRevision: 4,
    });
  });

  it('Given more matching posts than D1 bind variables permit, when pruning, then removes all matching posts', async () => {
    const { feedId } = await insertFeed(FEED_URI);
    await env.DB.batch(
      Array.from({ length: 101 }, (_, index) =>
        env.DB.prepare(
          'INSERT INTO posts (feed_id, uri, cid, indexed_at, order_rank) VALUES (?, ?, ?, ?, ?)'
        ).bind(
          feedId,
          `at://did:plc:testuser/app.bsky.feed.post/post${index}`,
          TEST_CID,
          '2025-12-31T00:00:00.000Z',
          `rank${index}`
        )
      )
    );

    const { response, json } = await callProcedure(PRUNE_BEFORE_PATH, {
      feed: FEED_URI,
      before: '2026-01-01T00:00:00.000Z',
    });

    expect(response.status).toBe(200);
    expect(json).toEqual({
      feed: FEED_URI,
      before: '2026-01-01T00:00:00.000Z',
      deletedCount: 101,
      orderRevision: 1,
    });
    const rows = await env.DB.prepare('SELECT COUNT(*) AS count FROM posts WHERE feed_id = ?')
      .bind(feedId)
      .all<{ count: number }>();
    expect(rows.results).toEqual([{ count: 0 }]);
  });
});
