import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AUTHOR_DID,
  TEST_CID,
  FEED_URI,
  insertFeed,
  insertPost,
  resetFeedTables,
  callProcedure,
} from './feedTest.shared';
import { findOrderRevision, REMOVE_BY_AUTHOR_PATH } from './postMutation.shared';

describe('removePostsByAuthor', () => {
  beforeEach(resetFeedTables);

  it('Given an author without matching posts When removing in developer mode Then the summary excludes the author DID', async () => {
    await insertFeed(FEED_URI);
    const output = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const { response } = await callProcedure(
        REMOVE_BY_AUTHOR_PATH,
        { feed: FEED_URI, author: 'did:plc:otherauthor' },
        { DEVELOPER_MODE: 'enabled' }
      );
      expect(response.status).toBe(200);
      const records = output.mock.calls.map(([line]) => JSON.parse(String(line)));
      expect(records).toContainEqual(
        expect.objectContaining({
          event: 'feed.remove.author.success',
          candidateCount: 0,
          deletedCount: 0,
        })
      );
      expect(JSON.stringify(records)).not.toContain('did:plc:otherauthor');
    } finally {
      output.mockRestore();
    }
  });

  it('Given posts from matching and prefix-sharing authors When removing by author Then removes only posts whose parsed repository matches the author DID', async () => {
    const { feedId } = await insertFeed(FEED_URI);
    const prefixSharingAuthor = 'did:plc:author-other';
    const otherAuthor = 'did:plc:other';
    await insertPost(feedId, {
      uri: `at://${AUTHOR_DID}/app.bsky.feed.post/matching`,
      cid: TEST_CID,
    });
    await insertPost(feedId, {
      uri: `at://${prefixSharingAuthor}/app.bsky.feed.post/prefix-sharing`,
      cid: TEST_CID,
    });
    await insertPost(feedId, {
      uri: `at://${otherAuthor}/app.bsky.feed.post/other`,
      cid: TEST_CID,
    });

    const { response, json } = await callProcedure(REMOVE_BY_AUTHOR_PATH, {
      feed: FEED_URI,
      author: AUTHOR_DID,
    });

    expect(response.status).toBe(200);
    expect(json).toEqual({
      feed: FEED_URI,
      author: AUTHOR_DID,
      deletedCount: 1,
      orderRevision: 1,
    });
    const rows = await env.DB.prepare('SELECT uri FROM posts WHERE feed_id = ? ORDER BY uri')
      .bind(feedId)
      .all<{ uri: string }>();
    expect(rows.results).toEqual([
      { uri: `at://${prefixSharingAuthor}/app.bsky.feed.post/prefix-sharing` },
      { uri: `at://${otherAuthor}/app.bsky.feed.post/other` },
    ]);
  });

  it('Given a feed with matching posts When removing by author without an expected revision Then deletes the matches and advances the revision once', async () => {
    const { feedId } = await insertFeed(FEED_URI, 1, 1, 3);
    await insertPost(feedId, {
      uri: `at://${AUTHOR_DID}/app.bsky.feed.post/matching`,
      cid: TEST_CID,
      orderRank: 'a',
    });

    const { response, json } = await callProcedure(REMOVE_BY_AUTHOR_PATH, {
      feed: FEED_URI,
      author: AUTHOR_DID,
    });

    expect(response.status).toBe(200);
    expect(json).toEqual({
      feed: FEED_URI,
      author: AUTHOR_DID,
      deletedCount: 1,
      orderRevision: 4,
    });
    await expect(findOrderRevision(feedId)).resolves.toBe(4);
  });

  it('Given a feed without posts by the author When removing by author Then returns a no-op without advancing the revision', async () => {
    const { feedId } = await insertFeed(FEED_URI, 1, 1, 3);

    const { response, json } = await callProcedure(REMOVE_BY_AUTHOR_PATH, {
      feed: FEED_URI,
      author: AUTHOR_DID,
    });

    expect(response.status).toBe(200);
    expect(json).toEqual({
      feed: FEED_URI,
      author: AUTHOR_DID,
      deletedCount: 0,
      orderRevision: 3,
    });
    await expect(findOrderRevision(feedId)).resolves.toBe(3);
  });
});
