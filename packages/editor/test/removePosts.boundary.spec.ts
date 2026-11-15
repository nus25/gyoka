import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  TEST_CID,
  FEED_URI,
  insertFeed,
  resetFeedTables,
  countPostsByFeedUri,
  callProcedure,
} from './feedTest.shared';
import { REMOVE_PATH } from './postMutation.shared';

describe('removePosts', () => {
  beforeEach(resetFeedTables);

  it('Given 1000 post URIs, when removing them, then removes all posts', async () => {
    const { feedId } = await insertFeed(FEED_URI);
    const posts = Array.from({ length: 1_000 }, (_, index) => ({
      uri: `at://did:plc:author/app.bsky.feed.post/post-${index}`,
      cid: TEST_CID,
    }));
    const indexedAt = new Date().toISOString();
    for (let index = 0; index < posts.length; index += 20) {
      const batch = posts.slice(index, index + 20);
      await env.DB.prepare(
        `INSERT INTO posts (feed_id, uri, cid, indexed_at, order_rank) VALUES ${batch
          .map(() => '(?, ?, ?, ?, ?)')
          .join(', ')}`
      )
        .bind(
          ...batch.flatMap((post, batchIndex) => [
            feedId,
            post.uri,
            post.cid,
            indexedAt,
            `a${(index + batchIndex).toString().padStart(4, '0')}U`,
          ])
        )
        .run();
    }

    const { response, json } = await callProcedure(REMOVE_PATH, {
      feed: FEED_URI,
      uris: posts.map((post) => post.uri),
    });

    expect(response.status).toBe(200);
    expect(json).toEqual({ feed: FEED_URI, deletedCount: 1_000, orderRevision: 1 });
    await expect(countPostsByFeedUri(FEED_URI)).resolves.toBe(0);
  });
});
