import { beforeEach, describe, expect, it } from 'vitest';

import { countFeedRowsByUri, FEED_URI } from './feedTest.shared';
import { ENDPOINT_PATH, resetFeedTables, updateFeed } from './updateFeed.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetFeedTables();
  });

  describe('Error cases', () => {
    it('Given no update field When updateFeed is called Then bad request is returned', async () => {
      const { response, json } = await updateFeed({
        uri: FEED_URI,
      });

      expect(response.status).toBe(400);
      expect(json).toEqual({
        error: 'BadRequest',
        message: 'No value for update in request',
      });

      expect(await countFeedRowsByUri(FEED_URI)).toBe(0);
    });

    it('Given feed URI is invalid When updateFeed is called Then bad request is returned', async () => {
      const { response, json } = await updateFeed({ uri: 'invalid-uri', isActive: false });

      expect(response.status).toBe(400);
      expect(json).toMatchObject({ error: 'BadRequest' });
    });

    it('Given feed URI collection is invalid When updateFeed is called Then bad request is returned', async () => {
      const uri = 'at://did:plc:testuser/app.bsky.feed.post/feed1';
      const { response, json } = await updateFeed({ uri, isActive: false });

      expect(response.status).toBe(400);
      expect(json).toEqual({ error: 'BadRequest', message: 'Invalid feed URI collection' });
    });

    it('Given feed does not exist When updateFeed is called Then unknown feed is returned', async () => {
      const { response, json } = await updateFeed({ uri: FEED_URI, isActive: false });

      expect(response.status).toBe(404);
      expect(json).toEqual({
        error: 'UnknownFeed',
        message: `Feed with URI ${FEED_URI} does not exist`,
      });
    });

    it('Given feed query reports failure When updateFeed is called Then internal server error is returned', async () => {
      const failingDb = {
        prepare: () => ({
          bind: () => ({ all: async () => ({ success: false, results: [] }) }),
        }),
      } as unknown as D1Database;
      const { response, json } = await updateFeed(
        { uri: FEED_URI, isActive: false },
        { DB: failingDb }
      );

      expect(response.status).toBe(500);
      expect(json).toEqual({
        error: 'InternalServerError',
        message: 'Failed to query the database',
      });
    });

    it('Given feed query throws exception When updateFeed is called Then internal server error is returned', async () => {
      const throwingDb = {
        prepare: () => ({
          bind: () => ({
            all: async () => {
              throw new Error('Database error');
            },
          }),
        }),
      } as unknown as D1Database;
      const { response, json } = await updateFeed(
        { uri: FEED_URI, isActive: false },
        { DB: throwingDb }
      );

      expect(response.status).toBe(500);
      expect(json).toMatchObject({ error: 'InternalServerError' });
    });

    it('Given feed update batch reports failure When updateFeed is called Then internal server error is returned', async () => {
      const failingDb = {
        prepare: () => ({
          bind: () => ({
            all: async () => ({
              success: true,
              results: [
                {
                  feed_uri: FEED_URI,
                  lang_filter: 1,
                  is_active: 1,
                  order_revision: 0,
                },
              ],
            }),
          }),
        }),
        batch: async () => [{ success: false }],
      } as unknown as D1Database;
      const { response, json } = await updateFeed(
        { uri: FEED_URI, isActive: false },
        { DB: failingDb }
      );

      expect(response.status).toBe(500);
      expect(json).toEqual({ error: 'InternalServerError', message: 'Failed to update feed' });
    });

    it('Given feed update batch throws exception When updateFeed is called Then internal server error is returned', async () => {
      const throwingDb = {
        prepare: () => ({
          bind: () => ({
            all: async () => ({
              success: true,
              results: [
                {
                  feed_uri: FEED_URI,
                  lang_filter: 1,
                  is_active: 1,
                  order_revision: 0,
                },
              ],
            }),
          }),
        }),
        batch: async () => {
          throw new Error('Database error');
        },
      } as unknown as D1Database;
      const { response, json } = await updateFeed(
        { uri: FEED_URI, isActive: false },
        { DB: throwingDb }
      );

      expect(response.status).toBe(500);
      expect(json).toMatchObject({ error: 'InternalServerError' });
    });
  });
});
