import { env } from 'cloudflare:workers';
import { describe, it, expect, beforeEach } from 'vitest';

import {
  assertValidResponse,
  DEFAULT_FEED_URI,
  ENDPOINT_PATH,
  seedDefaultFeed,
  updateFeed,
} from './updateFeed.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await seedDefaultFeed();
  });

  describe('Success cases', () => {
    it('Given all updatable fields are provided When update feed is called Then both fields are updated', async () => {
      const request = {
        uri: DEFAULT_FEED_URI,
        langFilter: false,
        isActive: false,
      };

      const { response, json } = await updateFeed(request);
      assertValidResponse(response);
      expect(json).toEqual({
        message: 'Feed updated successfully',
        feed: {
          uri: DEFAULT_FEED_URI,
          langFilter: false,
          isActive: false,
        },
      });

      const db = env.DB;
      const { results } = await db
        .prepare('SELECT * FROM feeds WHERE feed_uri = ?')
        .bind(request.uri)
        .all();
      expect(results.length).toBe(1);
      expect(results[0].feed_uri).toBe(request.uri);
      expect(results[0].lang_filter).toBe(0);
      expect(results[0].is_active).toBe(0);
    });

    it('Given only langFilter is provided When update feed is called Then only langFilter is changed', async () => {
      const request = {
        uri: DEFAULT_FEED_URI,
        langFilter: false,
      };

      const { response, json } = await updateFeed(request);
      assertValidResponse(response);
      expect(json).toEqual({
        message: 'Feed updated successfully',
        feed: {
          uri: DEFAULT_FEED_URI,
          langFilter: false,
          isActive: true,
        },
      });

      const db = env.DB;
      const { results } = await db
        .prepare('SELECT * FROM feeds WHERE feed_uri = ?')
        .bind(request.uri)
        .all();
      expect(results.length).toBe(1);
      expect(results[0].feed_uri).toBe(request.uri);
      expect(results[0].lang_filter).toBe(0);
      expect(results[0].is_active).toBe(1);
    });

    it('Given only isActive is provided When update feed is called Then only isActive is changed', async () => {
      const request = {
        uri: DEFAULT_FEED_URI,
        isActive: false,
      };

      const { response, json } = await updateFeed(request);
      assertValidResponse(response);
      expect(json).toEqual({
        message: 'Feed updated successfully',
        feed: {
          uri: DEFAULT_FEED_URI,
          langFilter: true,
          isActive: false,
        },
      });

      const db = env.DB;
      const { results } = await db
        .prepare('SELECT * FROM feeds WHERE feed_uri = ?')
        .bind(request.uri)
        .all();
      expect(results.length).toBe(1);
      expect(results[0].feed_uri).toBe(request.uri);
      expect(results[0].lang_filter).toBe(1);
      expect(results[0].is_active).toBe(0);
    });
  });
});
