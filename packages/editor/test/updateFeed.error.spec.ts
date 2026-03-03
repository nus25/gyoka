import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_FEED_URI, ENDPOINT_PATH, seedDefaultFeed, updateFeed } from './updateFeed.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await seedDefaultFeed();
  });

  describe('Error cases', () => {
    it('Given no updatable fields are provided When update feed is called Then it returns bad request', async () => {
      const request = {
        uri: DEFAULT_FEED_URI,
      };

      const { response, json } = await updateFeed(request);
      expect(response.status).toBe(400);
      expect(json).toEqual({
        error: 'BadRequest',
        message: 'No value for update in request',
      });
    });

    it('Given feed does not exist When update feed is called Then it returns unknown feed', async () => {
      const request = {
        uri: 'at://did:plc:nonexistent/app.bsky.feed.generator/feed',
        langFilter: true,
        isActive: true,
      };

      const { response, json } = await updateFeed(request);
      expect(response.status).toBe(404);
      expect(json).toEqual({
        error: 'UnknownFeed',
        message:
          'Feed with URI at://did:plc:nonexistent/app.bsky.feed.generator/feed does not exist',
      });
    });

    it('Given feed select query fails When update feed is called Then it returns internal server error', async () => {
      const failingEnv = {
        DB: {
          prepare: () => ({
            bind: () => ({
              all: async () => ({ success: false, results: [] }),
            }),
          }),
        } as unknown as D1Database,
      };

      const { response, json } = await updateFeed(
        {
          uri: DEFAULT_FEED_URI,
          langFilter: false,
        },
        failingEnv
      );

      expect(response.status).toBe(500);
      expect(json).toEqual({
        error: 'InternalServerError',
        message: 'Failed to query the database',
      });
    });

    it('Given feed update batch fails When update feed is called Then it returns internal server error', async () => {
      const failingBatchEnv = {
        DB: {
          prepare: (sql: string) => {
            if (sql === 'SELECT * FROM feeds WHERE feed_uri = ?') {
              return {
                bind: () => ({
                  all: async () => ({
                    success: true,
                    results: [
                      {
                        feed_uri: DEFAULT_FEED_URI,
                        lang_filter: 1,
                        is_active: 1,
                      },
                    ],
                  }),
                }),
              };
            }

            return {
              bind: () => ({}),
            };
          },
          batch: async () => [{ success: false }],
        } as unknown as D1Database,
      };

      const { response, json } = await updateFeed(
        {
          uri: DEFAULT_FEED_URI,
          langFilter: false,
        },
        failingBatchEnv
      );

      expect(response.status).toBe(500);
      expect(json).toEqual({
        error: 'InternalServerError',
        message: 'Failed to update feed',
      });
    });
  });
});
