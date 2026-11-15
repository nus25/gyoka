import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_CID, FEED_URI, insertFeed, resetFeedTables, callProcedure } from './feedTest.shared';
import {
  findOrderRevision,
  orderedUris,
  POST_ONE,
  POST_TWO,
  PUT_PATH,
} from './postMutation.shared';

function withD1CallCounter(db: Env['DB']) {
  let calls = 0;
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
        return db.batch(statements.map((statement) => originals.get(statement) ?? statement));
      },
    } as Env['DB'],
    calls: () => calls,
  };
}

function withPreparedQueryCapture(db: Env['DB']) {
  const queries: string[] = [];
  return {
    db: {
      prepare: (query: string) => {
        queries.push(query);
        return db.prepare(query);
      },
      batch: (statements: D1PreparedStatement[]) => db.batch(statements),
    } as Env['DB'],
    queries: () => queries,
  };
}

describe('putPosts', () => {
  beforeEach(resetFeedTables);

  it('Given developer mode is disabled, when putting a post, then does not emit a success debug log', async () => {
    await insertFeed(FEED_URI);
    const output = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const { response } = await callProcedure(
        PUT_PATH,
        { feed: FEED_URI, posts: [{ uri: POST_ONE, cid: TEST_CID }] },
        { DEVELOPER_MODE: 'disabled' }
      );
      expect(response.status).toBe(200);
      expect(output.mock.calls).toHaveLength(0);
    } finally {
      output.mockRestore();
    }
  });

  it('Given developer mode is enabled, when putting a post, then logs its operation summary at debug level', async () => {
    await insertFeed(FEED_URI);
    const output = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const { response } = await callProcedure(
        PUT_PATH,
        { feed: FEED_URI, posts: [{ uri: POST_ONE, cid: TEST_CID }] },
        { DEVELOPER_MODE: 'enabled' }
      );

      expect(response.status).toBe(200);
      const records = output.mock.calls.map(([line]) => JSON.parse(String(line)));
      expect(records).toContainEqual(
        expect.objectContaining({
          level: 'debug',
          event: 'feed.put.posts.success',
          postCount: 1,
          placement: 'append',
          previousRevision: 0,
          orderRevision: 1,
        })
      );
      expect(JSON.stringify(records)).not.toContain(POST_ONE);
    } finally {
      output.mockRestore();
    }
  });

  it('Given a new post, when putting it, then executes two D1 calls', async () => {
    await insertFeed(FEED_URI);
    const counted = withD1CallCounter(env.DB);

    const { response } = await callProcedure(
      PUT_PATH,
      { feed: FEED_URI, posts: [{ uri: POST_ONE, cid: TEST_CID }] },
      { DB: counted.db }
    );

    expect(response.status).toBe(200);
    expect(counted.calls()).toBe(2);
  });

  it('Given posts to put, when inserting their languages, then fixes input before posts in join order', async () => {
    await insertFeed(FEED_URI);
    const captured = withPreparedQueryCapture(env.DB);

    const { response } = await callProcedure(
      PUT_PATH,
      { feed: FEED_URI, posts: [{ uri: POST_ONE, cid: TEST_CID, languages: ['ja'] }] },
      { DB: captured.db }
    );

    expect(response.status).toBe(200);
    expect(captured.queries()).toContainEqual(
      expect.stringContaining(
        `FROM json_each(?) AS input
         CROSS JOIN posts
         CROSS JOIN json_each(json_extract(input.value, '$.languages')) AS language
         WHERE posts.feed_id = ? AND posts.uri = json_extract(input.value, '$.uri')`
      )
    );
  });

  it('Given ordered posts in input order, when putting them, then advances revision once', async () => {
    const { feedId } = await insertFeed(FEED_URI);
    const { response, json } = await callProcedure(PUT_PATH, {
      feed: FEED_URI,
      posts: [
        { uri: POST_ONE, cid: TEST_CID, languages: [' JA-jp ', 'ja'] },
        { uri: POST_TWO, cid: TEST_CID },
      ],
    });

    expect(response.status).toBe(200);
    expect(json).toEqual({ feed: FEED_URI, orderRevision: 1 });
    await expect(findOrderRevision(feedId)).resolves.toBe(1);
  });

  it('Given an existing post, when putting it again, then replaces it with a latest order rank', async () => {
    const { feedId } = await insertFeed(FEED_URI);
    await callProcedure(PUT_PATH, {
      feed: FEED_URI,
      posts: [{ uri: POST_ONE, cid: TEST_CID, languages: ['ja'] }],
    });
    await callProcedure(PUT_PATH, {
      feed: FEED_URI,
      posts: [{ uri: POST_TWO, cid: TEST_CID }],
    });

    const previousRank = await (
      await import('cloudflare:workers')
    ).env.DB.prepare('SELECT order_rank FROM posts WHERE feed_id = ? AND uri = ?')
      .bind(feedId, POST_ONE)
      .first<{ order_rank: string }>();

    const { response, json } = await callProcedure(PUT_PATH, {
      feed: FEED_URI,
      posts: [{ uri: POST_ONE, cid: TEST_CID, languages: ['en'] }],
    });

    expect(response.status).toBe(200);
    expect(json).toEqual({ feed: FEED_URI, orderRevision: 3 });
    await expect(findOrderRevision(feedId)).resolves.toBe(3);
    await expect(
      (await import('cloudflare:workers')).env.DB.prepare(
        'SELECT uri FROM posts WHERE feed_id = ? ORDER BY order_rank DESC LIMIT 1'
      )
        .bind(feedId)
        .first<{ uri: string }>()
    ).resolves.toEqual({ uri: POST_ONE });
    await expect(
      (await import('cloudflare:workers')).env.DB.prepare(
        'SELECT order_rank FROM posts WHERE feed_id = ? AND uri = ?'
      )
        .bind(feedId, POST_ONE)
        .first<{ order_rank: string }>()
    ).resolves.not.toEqual(previousRank);
    await expect(
      (await import('cloudflare:workers')).env.DB.prepare(
        'SELECT language FROM post_languages WHERE post_id = (SELECT post_id FROM posts WHERE feed_id = ? AND uri = ?)'
      )
        .bind(feedId, POST_ONE)
        .all<{ language: string }>()
    ).resolves.toMatchObject({ results: [{ language: 'en' }] });
  });

  it('Given an existing post, when putting it before an anchor, then replaces it at the requested placement', async () => {
    const { feedId } = await insertFeed(FEED_URI);
    await callProcedure(PUT_PATH, {
      feed: FEED_URI,
      posts: [{ uri: POST_ONE, cid: TEST_CID }],
    });
    await callProcedure(PUT_PATH, {
      feed: FEED_URI,
      posts: [{ uri: POST_TWO, cid: TEST_CID }],
    });

    const { response, json } = await callProcedure(PUT_PATH, {
      feed: FEED_URI,
      posts: [{ uri: POST_TWO, cid: TEST_CID }],
      placement: { type: 'before', anchor: POST_ONE },
    });

    expect(response.status).toBe(200);
    expect(json).toEqual({ feed: FEED_URI, orderRevision: 3 });
    await expect(orderedUris(feedId)).resolves.toEqual([POST_TWO, POST_ONE]);
  });
});
