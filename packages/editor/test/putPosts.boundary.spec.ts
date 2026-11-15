import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { TEST_CID, FEED_URI, insertFeed, resetFeedTables, callProcedure } from './feedTest.shared';
import { PUT_PATH } from './postMutation.shared';

function withBatchCounter(db: Env['DB']) {
  let statementCount = 0;
  return {
    db: {
      prepare: db.prepare.bind(db),
      batch: async (statements: D1PreparedStatement[]) => {
        statementCount = statements.length;
        return db.batch(statements);
      },
    } as Env['DB'],
    statementCount: () => statementCount,
  };
}

describe('putPosts', () => {
  beforeEach(resetFeedTables);

  it('Given 1000 posts, when putting them, then accepts them in a four-statement batch', async () => {
    await insertFeed(FEED_URI);
    const posts = Array.from({ length: 1_000 }, (_, index) => ({
      uri: `at://did:plc:author/app.bsky.feed.post/post-${index}`,
      cid: TEST_CID,
    }));
    const counted = withBatchCounter(env.DB);

    const { response, json } = await callProcedure(
      PUT_PATH,
      { feed: FEED_URI, posts },
      { DB: counted.db }
    );

    expect(response.status).toBe(200);
    expect(json).toEqual({ feed: FEED_URI, orderRevision: 1 });
    expect(counted.statementCount()).toBe(4);
  });

  it('Given nine posts, when putting them, then accepts all posts', async () => {
    await insertFeed(FEED_URI);
    const posts = Array.from({ length: 9 }, (_, index) => ({
      uri: `at://did:plc:author/app.bsky.feed.post/post-${index}`,
      cid: TEST_CID,
    }));

    const { response, json } = await callProcedure(PUT_PATH, { feed: FEED_URI, posts });

    expect(response.status).toBe(200);
    expect(json).toEqual({ feed: FEED_URI, orderRevision: 1 });
  });

  it('Given five languages, when putting a post, then accepts the post', async () => {
    await insertFeed(FEED_URI);

    const { response, json } = await callProcedure(PUT_PATH, {
      feed: FEED_URI,
      posts: [
        {
          uri: 'at://did:plc:author/app.bsky.feed.post/languages',
          cid: TEST_CID,
          languages: ['en', 'ja', 'fr', 'de', 'es'],
        },
      ],
    });

    expect(response.status).toBe(200);
    expect(json).toEqual({ feed: FEED_URI, orderRevision: 1 });
  });
});
