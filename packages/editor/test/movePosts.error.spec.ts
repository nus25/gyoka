import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FEED_URI, insertFeed, resetFeedTables, callProcedure } from './feedTest.shared';
import { MOVE_PATH, POST_ONE } from './postMutation.shared';

describe('movePosts', () => {
  beforeEach(resetFeedTables);

  it('Given a stale revision When moving posts Then the warning includes both revisions without post URIs', async () => {
    await insertFeed(FEED_URI);
    const output = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { response } = await callProcedure(
        MOVE_PATH,
        {
          feed: FEED_URI,
          posts: [POST_ONE],
          placement: { type: 'append' },
          expectedRevision: 1,
        },
        { DEVELOPER_MODE: 'disabled' }
      );
      expect(response.status).toBe(409);
      const records = output.mock.calls.map(([line]) => JSON.parse(String(line)));
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        operation: 'movePosts',
        postCount: 1,
        expectedRevision: 1,
        previousRevision: 0,
      });
      expect(JSON.stringify(records)).not.toContain(POST_ONE);
    } finally {
      output.mockRestore();
    }
  });

  it('Given a stale expected revision, when moving a post, then returns revision conflict', async () => {
    await insertFeed(FEED_URI);

    const { response, json } = await callProcedure(MOVE_PATH, {
      feed: FEED_URI,
      posts: [POST_ONE],
      placement: { type: 'append' },
      expectedRevision: 1,
    });

    expect(response.status).toBe(409);
    expect(json).toEqual({
      error: 'RevisionConflict',
      message: 'The feed revision changed.',
    });
  });

  it('Given a post that does not exist, when moving it, then returns bad request', async () => {
    await insertFeed(FEED_URI);

    const { response, json } = await callProcedure(MOVE_PATH, {
      feed: FEED_URI,
      posts: [POST_ONE],
      placement: { type: 'append' },
      expectedRevision: 0,
    });

    expect(response.status).toBe(400);
    expect(json).toEqual({
      error: 'BadRequest',
      message: 'All posts to move must exist.',
    });
  });

  it('Given an unknown feed, when moving a post, then returns unknown feed', async () => {
    const { response, json } = await callProcedure(MOVE_PATH, {
      feed: FEED_URI,
      posts: [POST_ONE],
      placement: { type: 'append' },
      expectedRevision: 0,
    });

    expect(response.status).toBe(404);
    expect(json).toEqual({
      error: 'UnknownFeed',
      message: `Feed with URI ${FEED_URI} does not exist.`,
    });
  });

  it('Given before placement has no anchor, when moving a post, then returns bad request', async () => {
    await insertFeed(FEED_URI);

    const { response, json } = await callProcedure(MOVE_PATH, {
      feed: FEED_URI,
      posts: [POST_ONE],
      placement: { type: 'before' },
      expectedRevision: 0,
    });

    expect(response.status).toBe(400);
    expect(json).toEqual({
      error: 'BadRequest',
      message: 'before and after placement require an anchor.',
    });
  });

  it('Given placement anchor is also being moved, when moving posts, then returns bad request', async () => {
    await insertFeed(FEED_URI);

    const { response, json } = await callProcedure(MOVE_PATH, {
      feed: FEED_URI,
      posts: [POST_ONE],
      placement: { type: 'before', anchor: POST_ONE },
      expectedRevision: 0,
    });

    expect(response.status).toBe(400);
    expect(json).toEqual({ error: 'BadRequest', message: 'Placement anchor cannot be moved.' });
  });
});
