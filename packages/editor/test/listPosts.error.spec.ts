import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { insertFeed, insertPost } from './feedTest.shared';
import { ENDPOINT_PATH, FEED_URI, listPosts, resetFeedTables } from './listPosts.shared';

const AUTHOR = 'did:plc:author';
const POST = `at://${AUTHOR}/app.bsky.feed.post/one`;

describe(ENDPOINT_PATH, () => {
  beforeEach(resetFeedTables);

  it('Given a malformed cursor When listPosts is called Then BadRequest is returned', async () => {
    const { response, json } = await listPosts({ feed: FEED_URI, cursor: 'not-a-cursor' });

    expect(response.status).toBe(400);
    expect(json).toMatchObject({ error: 'BadRequest' });
  });

  it('Given a cursor with an author condition When listPosts receives a different author Then BadRequest is returned', async () => {
    const { feedId } = await insertFeed(FEED_URI);
    await insertPost(feedId, { uri: POST });
    const firstPage = await listPosts({ feed: FEED_URI, author: AUTHOR, limit: 1 });

    const { response, json } = await listPosts({
      cursor: firstPage.json.cursor as string,
      author: 'did:plc:other',
    });

    expect(response.status).toBe(400);
    expect(json).toMatchObject({ error: 'BadRequest' });
  });

  it('Given no feed or cursor When listPosts is called Then BadRequest is returned', async () => {
    const { response, json } = await listPosts({});

    expect(response.status).toBe(400);
    expect(json).toMatchObject({ error: 'BadRequest' });
  });

  it('Given conflicting uri and author filters When listPosts is called Then BadRequest is returned', async () => {
    const { feedId } = await insertFeed(FEED_URI);
    await insertPost(feedId, { uri: POST });

    const { response, json } = await listPosts({
      feed: FEED_URI,
      uri: POST,
      author: 'did:plc:other',
    });

    expect(response.status).toBe(400);
    expect(json).toMatchObject({ error: 'BadRequest' });
  });

  it('Given an invalid author DID When listPosts is called Then BadRequest is returned', async () => {
    const { response, json } = await listPosts({ feed: FEED_URI, author: 'not-a-did' });

    expect(response.status).toBe(400);
    expect(json).toMatchObject({ error: 'BadRequest' });
  });

  it('Given an unknown feed When listPosts is called Then UnknownFeed is returned', async () => {
    const { response, json } = await listPosts({ feed: FEED_URI });

    expect(response.status).toBe(404);
    expect(json).toEqual({
      error: 'UnknownFeed',
      message: `Feed with URI ${FEED_URI} does not exist.`,
    });
  });

  it('Given the posts query reports failure When listPosts is called Then InternalServerError is returned', async () => {
    const failingDb = {
      prepare: () => ({
        bind: () => ({
          first: async () => ({
            feed_id: 1,
            order_revision: 0,
          }),
          all: async () => ({ success: false, results: [] }),
        }),
      }),
    } as unknown as D1Database;

    const { response, json } = await listPosts({ feed: FEED_URI }, { DB: failingDb });

    expect(response.status).toBe(500);
    expect(json).toEqual({
      error: 'InternalServerError',
      message: 'Failed to fetch posts.',
    });
  });

  it('Given a legacy cursor When listPosts is called Then BadRequest is returned', async () => {
    await insertFeed(FEED_URI);
    const cursor = btoa(
      JSON.stringify({
        version: 2,
        conditions: { feed: FEED_URI },
        position: { indexedAt: '2026-01-01T00:00:00.000Z', cid: 'cid', postId: 1 },
      })
    );

    const { response, json } = await listPosts({ cursor });

    expect(response.status).toBe(400);
    expect(json).toEqual({
      error: 'BadRequest',
      message: 'Malformed cursor.',
    });
  });

  it('Given a cursor with a stale revision When listPosts is called Then RevisionConflict is returned', async () => {
    const { feedId } = await insertFeed(FEED_URI, 1, 1, 7);
    await insertPost(feedId, { uri: POST, orderRank: 'a0' });
    const firstPage = await listPosts({ feed: FEED_URI, limit: 1 });
    await env.DB.prepare('UPDATE feeds SET order_revision = 8 WHERE feed_id = ?')
      .bind(feedId)
      .run();

    const { response, json } = await listPosts({ cursor: firstPage.json.cursor as string });

    expect(response.status).toBe(409);
    expect(json).toMatchObject({ error: 'RevisionConflict' });
  });
});
