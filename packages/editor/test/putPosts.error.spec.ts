import { createLogger } from 'shared/src/logger';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sanitizeAtcuteValidationResponse } from '../src/xrpcRouter';
import { TEST_CID, FEED_URI, insertFeed, resetFeedTables, callProcedure } from './feedTest.shared';
import { POST_ONE, PUT_PATH } from './postMutation.shared';

describe('putPosts', () => {
  beforeEach(resetFeedTables);

  it('Given validation issues containing document text When sanitizing the response Then the warning excludes input data', async () => {
    const output = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const response = Response.json(
        {
          error: 'InvalidRequest',
          message: 'private text',
          'net.kelinci.atcute.issues': [{ value: 'private text' }],
        },
        { status: 400 }
      );
      await sanitizeAtcuteValidationResponse(response, createLogger({}));
      const records = output.mock.calls.map(([line]) => JSON.parse(String(line)));
      expect(records[0]).toMatchObject({ issueCount: 1 });
      expect(JSON.stringify(records)).not.toContain('private text');
    } finally {
      output.mockRestore();
    }
  });

  it('Given duplicate post URIs and developer mode disabled, when putting posts, then logs the failure context once', async () => {
    const output = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { response } = await callProcedure(
        PUT_PATH,
        {
          feed: FEED_URI,
          posts: [
            { uri: POST_ONE, cid: TEST_CID },
            { uri: POST_ONE, cid: TEST_CID },
          ],
        },
        { DEVELOPER_MODE: 'disabled' }
      );

      expect(response.status).toBe(400);
      const records = output.mock.calls.map(([line]) => JSON.parse(String(line)));
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        level: 'warn',
        event: 'api.handle.exception.failed',
        operation: 'putPosts',
        stage: 'validation',
        postCount: 2,
        placement: 'append',
      });
      expect(JSON.stringify(records)).not.toContain(POST_ONE);
    } finally {
      output.mockRestore();
    }
  });

  it('Given a database write failure When putting posts Then one error log contains safe context and no database message', async () => {
    await insertFeed(FEED_URI);
    const { env } = await import('cloudflare:workers');
    let batchCount = 0;
    const db = {
      prepare: env.DB.prepare.bind(env.DB),
      batch: async (statements: D1PreparedStatement[]) => {
        batchCount += 1;
        if (batchCount === 2) throw new Error('private database details');
        return env.DB.batch(statements);
      },
    } as Env['DB'];
    const output = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { response } = await callProcedure(
        PUT_PATH,
        {
          feed: FEED_URI,
          posts: [{ uri: POST_ONE, cid: TEST_CID }],
        },
        { DB: db, DEVELOPER_MODE: 'disabled' }
      );
      expect(response.status).toBe(500);
      const records = output.mock.calls.map(([line]) => JSON.parse(String(line)));
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        operation: 'putPosts',
        stage: 'write',
        feed: FEED_URI,
        postCount: 1,
        previousRevision: 0,
        errorName: 'Error',
      });
      expect(JSON.stringify(records)).not.toContain('private database details');
      expect(JSON.stringify(records)).not.toContain(POST_ONE);
    } finally {
      output.mockRestore();
    }
  });

  it('Given duplicate post URIs, when putting posts, then returns bad request without inserting them', async () => {
    await insertFeed(FEED_URI);

    const { response, json } = await callProcedure(PUT_PATH, {
      feed: FEED_URI,
      posts: [
        { uri: POST_ONE, cid: TEST_CID },
        { uri: POST_ONE, cid: TEST_CID },
      ],
    });

    expect(response.status).toBe(400);
    expect(json).toEqual({
      error: 'BadRequest',
      message: 'posts must contain between 1 and 1000 unique URIs.',
    });
  });

  it('Given more than the maximum number of posts, when putting posts, then returns bad request', async () => {
    await insertFeed(FEED_URI);
    const posts = Array.from({ length: 1_001 }, (_, index) => ({
      uri: `at://did:plc:author/app.bsky.feed.post/post-${index}`,
      cid: TEST_CID,
    }));

    const { response, json } = await callProcedure(PUT_PATH, { feed: FEED_URI, posts });

    expect(response.status).toBe(400);
    expect(json).toEqual({
      error: 'BadRequest',
      message:
        'invalid input: invalid_array_length at .posts (expected an array between 1 and 1000 item(s))',
    });
  });

  it('Given more than five languages, when putting a post, then returns bad request', async () => {
    await insertFeed(FEED_URI);

    const { response, json } = await callProcedure(PUT_PATH, {
      feed: FEED_URI,
      posts: [{ uri: POST_ONE, cid: TEST_CID, languages: ['en', 'ja', 'fr', 'de', 'es', 'it'] }],
    });

    expect(response.status).toBe(400);
    expect(json).toMatchObject({ error: 'BadRequest' });
  });

  it('Given an unknown feed, when putting posts, then returns unknown feed', async () => {
    const { response, json } = await callProcedure(PUT_PATH, {
      feed: FEED_URI,
      posts: [{ uri: POST_ONE, cid: TEST_CID }],
    });

    expect(response.status).toBe(404);
    expect(json).toEqual({
      error: 'UnknownFeed',
      message: `Feed with URI ${FEED_URI} does not exist.`,
    });
  });

  it('Given an invalid language tag, when putting posts, then returns bad request', async () => {
    await insertFeed(FEED_URI);

    const { response, json } = await callProcedure(PUT_PATH, {
      feed: FEED_URI,
      posts: [{ uri: POST_ONE, cid: TEST_CID, languages: ['en_US'] }],
    });

    expect(response.status).toBe(400);
    expect(json).toEqual({
      error: 'BadRequest',
      message: 'All primary language tags must be two or three alphabetic characters.',
    });
  });

  it('Given a feed and placement, when putting posts, then creates ordered posts', async () => {
    await insertFeed(FEED_URI);

    const { response, json } = await callProcedure(PUT_PATH, {
      feed: FEED_URI,
      posts: [{ uri: POST_ONE, cid: TEST_CID }],
      placement: { type: 'append' },
    });

    expect(response.status).toBe(200);
    expect(json).toEqual({ feed: FEED_URI, orderRevision: 1 });
  });

  it('Given placement has no anchor, when putting posts, then returns bad request', async () => {
    await insertFeed(FEED_URI);

    const { response, json } = await callProcedure(PUT_PATH, {
      feed: FEED_URI,
      posts: [{ uri: POST_ONE, cid: TEST_CID }],
      placement: { type: 'before' },
    });

    expect(response.status).toBe(400);
    expect(json).toEqual({
      error: 'BadRequest',
      message: 'before and after placement require an anchor.',
    });
  });

  it('Given placement anchor is a new post URI, when putting posts, then returns bad request', async () => {
    await insertFeed(FEED_URI);

    const { response, json } = await callProcedure(PUT_PATH, {
      feed: FEED_URI,
      posts: [{ uri: POST_ONE, cid: TEST_CID }],
      placement: { type: 'after', anchor: POST_ONE },
    });

    expect(response.status).toBe(400);
    expect(json).toEqual({
      error: 'BadRequest',
      message: 'Placement anchor cannot be a new input URI.',
    });
  });

  it('Given the revision changes before the write batch, when putting a post, then returns conflict without storing it', async () => {
    const { feedId } = await insertFeed(FEED_URI);
    const { env } = await import('cloudflare:workers');
    let batches = 0;
    const dbWithRevisionChange = {
      prepare: env.DB.prepare.bind(env.DB),
      batch: async (statements: D1PreparedStatement[]) => {
        batches += 1;
        if (batches === 2) {
          await env.DB.prepare(
            'UPDATE feeds SET order_revision = order_revision + 1 WHERE feed_id = ?'
          )
            .bind(feedId)
            .run();
        }
        return env.DB.batch(statements);
      },
    } as Env['DB'];

    const { response, json } = await callProcedure(
      PUT_PATH,
      {
        feed: FEED_URI,
        posts: [{ uri: POST_ONE, cid: TEST_CID }],
      },
      { DB: dbWithRevisionChange }
    );

    expect(response.status).toBe(409);
    expect(json).toEqual({
      error: 'RevisionConflict',
      message: 'The feed revision changed.',
    });
  });
});
