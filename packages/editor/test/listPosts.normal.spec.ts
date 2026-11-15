import { beforeEach, describe, expect, it, vi } from 'vitest';

import { insertFeed, insertPost } from './feedTest.shared';
import { ENDPOINT_PATH, FEED_URI, listPosts, resetFeedTables } from './listPosts.shared';

const AUTHOR = 'did:plc:author';
const AUTHOR_POST = `at://${AUTHOR}/app.bsky.feed.post/one`;
const OTHER_AUTHOR_POST = 'at://did:plc:author2/app.bsky.feed.post/two';

describe(ENDPOINT_PATH, () => {
  beforeEach(resetFeedTables);

  it('Given an author filter When listing posts in developer mode Then the debug summary omits the author identity', async () => {
    await insertFeed(FEED_URI);
    const output = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const { response } = await listPosts(
        { feed: FEED_URI, author: AUTHOR, limit: 5 },
        { DEVELOPER_MODE: 'enabled' }
      );
      expect(response.status).toBe(200);
      const records = output.mock.calls.map(([line]) => JSON.parse(String(line)));
      expect(records).toContainEqual(
        expect.objectContaining({
          event: 'feed.list.posts.success',
          hasAuthor: true,
          resultCount: 0,
          orderRevision: 0,
        })
      );
      expect(JSON.stringify(records)).not.toContain(AUTHOR);
    } finally {
      output.mockRestore();
    }
  });

  it('Given ranked posts When listPosts is called Then posts are returned by descending rank and revision', async () => {
    const { feedId } = await insertFeed(FEED_URI);
    await insertPost(feedId, {
      uri: AUTHOR_POST,
      indexedAt: '2026-10-01T00:00:00.000Z',
      orderRank: 'a0',
    });
    await insertPost(feedId, {
      uri: OTHER_AUTHOR_POST,
      indexedAt: '2026-10-02T00:00:00.000Z',
      orderRank: 'a1',
    });

    const { response, json } = await listPosts({ feed: FEED_URI });

    expect(response.status).toBe(200);
    expect(json).toMatchObject({ feed: FEED_URI, orderRevision: 0 });
    expect(json).not.toHaveProperty('mode');
    expect((json.posts as Array<{ uri: string }>).map((post) => post.uri)).toEqual([
      OTHER_AUTHOR_POST,
      AUTHOR_POST,
    ]);
  });

  it('Given posts from matching and prefix-matching author DIDs When listPosts filters by author Then only the complete DID matches', async () => {
    const { feedId } = await insertFeed(FEED_URI);
    await insertPost(feedId, { uri: AUTHOR_POST });
    await insertPost(feedId, { uri: OTHER_AUTHOR_POST });

    const { response, json } = await listPosts({ feed: FEED_URI, author: AUTHOR });

    expect(response.status).toBe(200);
    expect((json.posts as Array<{ uri: string }>).map((post) => post.uri)).toEqual([AUTHOR_POST]);
  });

  it('Given a feed with ranked posts When listPosts continues with a cursor Then posts are ordered from the greatest rank at the same revision', async () => {
    const { feedId } = await insertFeed(FEED_URI, 1, 1, 7);
    await insertPost(feedId, { uri: OTHER_AUTHOR_POST, orderRank: 'a1' });
    await insertPost(feedId, { uri: AUTHOR_POST, orderRank: 'a0' });

    const firstPage = await listPosts({ feed: FEED_URI, limit: 1 });

    expect(firstPage.response.status).toBe(200);
    expect(firstPage.json).toMatchObject({ orderRevision: 7 });
    expect(firstPage.json).not.toHaveProperty('mode');
    expect((firstPage.json.posts as Array<{ uri: string }>).map((post) => post.uri)).toEqual([
      OTHER_AUTHOR_POST,
    ]);
    expect(firstPage.json.cursor).toEqual(expect.any(String));

    const secondPage = await listPosts({ cursor: firstPage.json.cursor as string });
    expect(secondPage.response.status).toBe(200);
    expect((secondPage.json.posts as Array<{ uri: string }>).map((post) => post.uri)).toEqual([
      AUTHOR_POST,
    ]);
  });
});
