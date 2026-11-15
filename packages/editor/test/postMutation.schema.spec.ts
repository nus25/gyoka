import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { FEED_URI, insertFeed, resetFeedTables } from './feedTest.shared';

describe('post mutation schema', () => {
  it('Given a post mutation, when applying it, then requires unique ranks without mutation leases', async () => {
    await resetFeedTables();
    const feed = await insertFeed(FEED_URI);

    await expect(
      env.DB.prepare('INSERT INTO posts (feed_id, uri, cid, indexed_at) VALUES (?, ?, ?, ?)')
        .bind(
          feed.feedId,
          'at://did:plc:author/app.bsky.feed.post/without-rank',
          'cid',
          new Date().toISOString()
        )
        .run()
    ).rejects.toThrow();

    await env.DB.prepare(
      'INSERT INTO posts (feed_id, uri, cid, indexed_at, order_rank) VALUES (?, ?, ?, ?, ?)'
    )
      .bind(
        feed.feedId,
        'at://did:plc:author/app.bsky.feed.post/one',
        'cid',
        new Date().toISOString(),
        'a0'
      )
      .run();
    await expect(
      env.DB.prepare(
        'INSERT INTO posts (feed_id, uri, cid, indexed_at, order_rank) VALUES (?, ?, ?, ?, ?)'
      )
        .bind(
          feed.feedId,
          'at://did:plc:author/app.bsky.feed.post/one',
          'cid2',
          new Date().toISOString(),
          'a1'
        )
        .run()
    ).rejects.toThrow();
    await expect(
      env.DB.prepare(
        'INSERT INTO posts (feed_id, uri, cid, indexed_at, order_rank) VALUES (?, ?, ?, ?, ?)'
      )
        .bind(
          feed.feedId,
          'at://did:plc:author/app.bsky.feed.post/two',
          'cid',
          new Date().toISOString(),
          'a0'
        )
        .run()
    ).rejects.toThrow();
    await expect(
      env.DB.prepare('UPDATE feeds SET order_mutation_token = ? WHERE feed_id = ?')
        .bind(null, feed.feedId)
        .run()
    ).rejects.toThrow();
  });
});
