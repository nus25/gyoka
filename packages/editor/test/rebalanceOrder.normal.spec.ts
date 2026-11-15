import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_CID, FEED_URI, insertFeed, resetFeedTables, callProcedure } from './feedTest.shared';
import {
  findOrderRevision,
  orderedUris,
  POST_ONE,
  POST_TWO,
  REBALANCE_PATH,
} from './postMutation.shared';

function withD1CallCounter(db: Env['DB']) {
  let calls = 0;
  let batchStatementCount = 0;
  const originals = new WeakMap<object, D1PreparedStatement>();
  const wrap = (statement: D1PreparedStatement): D1PreparedStatement => {
    const wrapped = new Proxy(statement, {
      get(target, property) {
        const value = Reflect.get(target, property);
        if (property === 'bind') {
          return (...values: unknown[]) => wrap(value.apply(target, values));
        }
        if (property === 'run' || property === 'first' || property === 'all') {
          return (...values: unknown[]) => {
            calls += 1;
            return value.apply(target, values);
          };
        }
        return value;
      },
    });
    originals.set(wrapped, statement);
    return wrapped;
  };
  return {
    db: {
      prepare: (query: string) => wrap(db.prepare(query)),
      batch: async (statements: D1PreparedStatement[]) => {
        calls += 1;
        batchStatementCount = statements.length;
        return db.batch(statements.map((statement) => originals.get(statement) ?? statement));
      },
    } as Env['DB'],
    calls: () => calls,
    batchStatementCount: () => batchStatementCount,
  };
}

describe('rebalanceOrder', () => {
  beforeEach(resetFeedTables);

  it('Given an empty feed and developer mode enabled, when rebalancing, then logs the no-op result at debug level', async () => {
    await insertFeed(FEED_URI);
    const output = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const { response } = await callProcedure(
        REBALANCE_PATH,
        { feed: FEED_URI, expectedRevision: 0 },
        { DEVELOPER_MODE: 'enabled' }
      );
      expect(response.status).toBe(200);
      const records = output.mock.calls.map(([line]) => JSON.parse(String(line)));
      expect(records).toContainEqual(
        expect.objectContaining({
          level: 'debug',
          event: 'feed.rebalance.order.success',
          postCount: 0,
          changed: false,
        })
      );
      expect(records.some((record) => record.level === 'info')).toBe(false);
    } finally {
      output.mockRestore();
    }
  });

  it('Given noncanonical ranks, when rebalancing, then executes two D1 calls', async () => {
    const { feedId } = await insertFeed(FEED_URI, 1, 1, 3);
    await env.DB.prepare(
      'INSERT INTO posts (feed_id, uri, cid, indexed_at, order_rank) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)'
    )
      .bind(
        feedId,
        POST_ONE,
        TEST_CID,
        new Date().toISOString(),
        'a0U',
        feedId,
        POST_TWO,
        TEST_CID,
        new Date().toISOString(),
        'a0z'
      )
      .run();
    const counted = withD1CallCounter(env.DB);

    const { response } = await callProcedure(
      REBALANCE_PATH,
      { feed: FEED_URI, expectedRevision: 3 },
      { DB: counted.db }
    );

    expect(response.status).toBe(200);
    expect(counted.calls()).toBe(2);
    expect(counted.batchStatementCount()).toBe(3);
  });

  it('Given noncanonical ranks, when rebalancing, then advances the revision', async () => {
    const { feedId } = await insertFeed(FEED_URI, 1, 1, 3);
    await env.DB.prepare(
      'INSERT INTO posts (feed_id, uri, cid, indexed_at, order_rank) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)'
    )
      .bind(
        feedId,
        POST_ONE,
        TEST_CID,
        new Date().toISOString(),
        'a0U',
        feedId,
        POST_TWO,
        TEST_CID,
        new Date().toISOString(),
        'a0z'
      )
      .run();

    const { response, json } = await callProcedure(REBALANCE_PATH, {
      feed: FEED_URI,
      expectedRevision: 3,
    });

    expect(response.status).toBe(200);
    expect(json).toMatchObject({ feed: FEED_URI, orderRevision: 4, postCount: 2 });
    await expect(
      env.DB.prepare('SELECT order_rank FROM posts WHERE feed_id = ? ORDER BY order_rank ASC')
        .bind(feedId)
        .all<{ order_rank: string }>()
    ).resolves.toMatchObject({ results: [{ order_rank: 'a0' }, { order_rank: 'a1' }] });
    await expect(findOrderRevision(feedId)).resolves.toBe(4);
  });

  it('Given 2000 posts, when rebalancing, then updates them in a three-statement batch', async () => {
    const { feedId } = await insertFeed(FEED_URI);
    const indexedAt = new Date().toISOString();
    const posts = Array.from({ length: 2_000 }, (_, index) => [
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
    const counted = withD1CallCounter(env.DB);

    const { response, json } = await callProcedure(
      REBALANCE_PATH,
      { feed: FEED_URI, expectedRevision: 0 },
      { DB: counted.db }
    );

    expect(response.status).toBe(200);
    expect(json).toMatchObject({ orderRevision: 1, postCount: 2_000 });
    expect(counted.batchStatementCount()).toBe(3);
  });

  it('Given a lost lease before the guarded batch, when rebalancing, then does not advance the revision', async () => {
    const { feedId } = await insertFeed(FEED_URI, 1, 1, 3);
    await env.DB.prepare(
      'INSERT INTO posts (feed_id, uri, cid, indexed_at, order_rank) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)'
    )
      .bind(
        feedId,
        POST_ONE,
        TEST_CID,
        new Date().toISOString(),
        'a0U',
        feedId,
        POST_TWO,
        TEST_CID,
        new Date().toISOString(),
        'a0z'
      )
      .run();
    let batches = 0;
    const dbWithRevisionChange = {
      prepare: env.DB.prepare.bind(env.DB),
      batch: async (statements: D1PreparedStatement[]) => {
        batches += 1;
        if (batches === 2) {
          await env.DB.prepare(
            `UPDATE feeds
             SET order_revision = order_revision + 1
             WHERE feed_id = ?`
          )
            .bind(feedId)
            .run();
        }
        return env.DB.batch(statements);
      },
    } as Env['DB'];

    const { response } = await callProcedure(
      REBALANCE_PATH,
      { feed: FEED_URI, expectedRevision: 3 },
      { DB: dbWithRevisionChange }
    );

    expect(response.status).toBe(409);
    await expect(findOrderRevision(feedId)).resolves.toBe(4);
  });

  it('Given ranks that could collide, when rebalancing, then rebalances without colliding with a later row', async () => {
    const { feedId } = await insertFeed(FEED_URI, 1, 1, 3);
    await env.DB.prepare(
      'INSERT INTO posts (feed_id, uri, cid, indexed_at, order_rank) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)'
    )
      .bind(
        feedId,
        POST_ONE,
        TEST_CID,
        new Date().toISOString(),
        'a0',
        feedId,
        POST_TWO,
        TEST_CID,
        new Date().toISOString(),
        'a0U',
        feedId,
        'at://did:plc:author/app.bsky.feed.post/three',
        TEST_CID,
        new Date().toISOString(),
        'a1'
      )
      .run();

    const { response, json } = await callProcedure(REBALANCE_PATH, {
      feed: FEED_URI,
      expectedRevision: 3,
    });

    expect(response.status).toBe(200);
    expect(json).toMatchObject({ orderRevision: 4, postCount: 3 });
    await expect(orderedUris(feedId)).resolves.toEqual([
      POST_ONE,
      POST_TWO,
      'at://did:plc:author/app.bsky.feed.post/three',
    ]);
  });
});
