import { beforeEach, describe, expect, it } from 'vitest';

import { FEED_URI, insertFeed, insertPost, POST_URI, POST_URI_2 } from './feedTest.shared';
import { ENDPOINT_PATH, getPosts, resetFeedTables } from './getPosts.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetFeedTables();
  });

  describe('Error cases', () => {
    it('Given malformed cursor When getPosts is called Then bad request is returned', async () => {
      const { response, json } = await getPosts({ feed: FEED_URI, cursor: 'invalid-cursor' });

      expect(response.status).toBe(400);
      expect(json).toEqual({
        error: 'BadRequest',
        message: 'Malformed cursor',
      });
    });

    it('Given a cursor and conflicting filters When getPosts is called Then bad request is returned', async () => {
      const { feedId } = await insertFeed(FEED_URI);
      await insertPost(feedId, { uri: POST_URI });
      await insertPost(feedId, { uri: POST_URI_2 });
      const firstPage = await getPosts({ feed: FEED_URI, uri: POST_URI, limit: 1 });
      const cursor = (firstPage.json as { cursor?: string }).cursor;

      const { response, json } = await getPosts({
        feed: FEED_URI,
        uri: POST_URI_2,
        cursor,
      });

      expect(response.status).toBe(400);
      expect(json).toEqual({
        error: 'BadRequest',
        message: 'Cursor search conditions do not match request parameters',
      });
    });

    it('Given neither feed nor cursor When getPosts is called Then bad request is returned', async () => {
      const { response, json } = await getPosts({});

      expect(response.status).toBe(400);
      expect(json).toEqual({
        error: 'BadRequest',
        message: 'Feed is required when cursor is omitted',
      });
    });
  });
});
