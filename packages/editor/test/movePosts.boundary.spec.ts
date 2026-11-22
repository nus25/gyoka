import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  TEST_CID,
  FEED_URI,
  insertFeed,
  insertPost,
  resetFeedTables,
  callProcedure,
} from './feedTest.shared';
import { MOVE_PATH, orderedUris } from './postMutation.shared';

describe('movePosts', () => {
  beforeEach(resetFeedTables);

  it('Given the maximum number of posts, when moving them, then accepts all 25 posts in input order', async () => {
    const { feedId } = await insertFeed(FEED_URI);
    const posts = Array.from({ length: 25 }, (_, index) => ({
      uri: `at://did:plc:author/app.bsky.feed.post/post-${index}`,
      cid: TEST_CID,
    }));
    await Promise.all(posts.map((post) => insertPost(feedId, post)));

    const orderedPosts = posts.map((post) => post.uri).reverse();
    let batchStatementCount = 0;
    const dbWithBatchCounter = {
      prepare: env.DB.prepare.bind(env.DB),
      batch: async (statements: D1PreparedStatement[]) => {
        batchStatementCount = statements.length;
        return env.DB.batch(statements);
      },
    } as Env['DB'];
    const { response, json } = await callProcedure(
      MOVE_PATH,
      {
        feed: FEED_URI,
        posts: orderedPosts,
        placement: { position: 'append' },
        expectedRevision: 0,
      },
      { DB: dbWithBatchCounter }
    );

    expect(response.status).toBe(200);
    expect(json.movedCount).toBe(25);
    expect(batchStatementCount).toBe(3);
    await expect(orderedUris(feedId)).resolves.toEqual(orderedPosts);
  });
});
