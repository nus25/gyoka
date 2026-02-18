import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ENDPOINT_PATH,
  assertValidResponse,
  batchRemovePosts,
  dummyFeed1,
  dummyFeed2,
  dummyPost1,
  dummyPost2,
  dummyPost3,
  insertFeed,
  insertPost,
  resetBatchRemoveTables,
  verifyPostExists,
  verifyPostLanguagesExist,
} from './batchRemovePosts.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetBatchRemoveTables();
  });

  describe('Success cases', () => {
    it('Given multiple feeds and posts When batch remove is called Then all posts are removed', async () => {
      const feedId1 = await insertFeed(dummyFeed1);
      const feedId2 = await insertFeed(dummyFeed2);
      await insertPost(feedId1, dummyPost1);
      await insertPost(feedId1, dummyPost2);
      await insertPost(feedId2, dummyPost3);

      expect(await verifyPostLanguagesExist(dummyPost1.id)).toBe(true);
      expect(await verifyPostLanguagesExist(dummyPost2.id)).toBe(true);
      expect(await verifyPostLanguagesExist(dummyPost3.id)).toBe(true);

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [
            { uri: dummyPost1.uri, indexedAt: dummyPost1.indexedAt },
            { uri: dummyPost2.uri, indexedAt: dummyPost2.indexedAt },
          ],
        },
        {
          feed: dummyFeed2.uri,
          posts: [{ uri: dummyPost3.uri, indexedAt: dummyPost3.indexedAt }],
        },
      ];

      const { response, json } = await batchRemovePosts(entries);
      assertValidResponse(response);

      expect(json.results).toHaveLength(2);
      expect(json.results![0].feed).toBe(dummyFeed1.uri);
      expect(json.results![0].results).toHaveLength(2);
      expect(json.results![0].results[0].status).toBe('removed');
      expect(json.results![0].results[0].uri).toBe(dummyPost1.uri);
      expect(json.results![0].results[1].status).toBe('removed');
      expect(json.results![0].results[1].uri).toBe(dummyPost2.uri);

      expect(json.results![1].feed).toBe(dummyFeed2.uri);
      expect(json.results![1].results).toHaveLength(1);
      expect(json.results![1].results[0].status).toBe('removed');
      expect(json.results![1].results[0].uri).toBe(dummyPost3.uri);

      expect(await verifyPostExists(dummyPost1.uri)).toBe(false);
      expect(await verifyPostExists(dummyPost2.uri)).toBe(false);
      expect(await verifyPostExists(dummyPost3.uri)).toBe(false);
      expect(await verifyPostLanguagesExist(dummyPost1.id)).toBe(false);
      expect(await verifyPostLanguagesExist(dummyPost2.id)).toBe(false);
      expect(await verifyPostLanguagesExist(dummyPost3.id)).toBe(false);
    });

    it('Given multiple entries for the same feed When batch remove is called Then entries are processed in input order', async () => {
      const feedId1 = await insertFeed(dummyFeed1);
      await insertPost(feedId1, dummyPost1);
      await insertPost(feedId1, dummyPost2);
      await insertPost(feedId1, dummyPost3);

      expect(await verifyPostLanguagesExist(dummyPost1.id)).toBe(true);
      expect(await verifyPostLanguagesExist(dummyPost2.id)).toBe(true);
      expect(await verifyPostLanguagesExist(dummyPost3.id)).toBe(true);

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [{ uri: dummyPost1.uri, indexedAt: dummyPost1.indexedAt }],
        },
        {
          feed: dummyFeed1.uri,
          posts: [{ uri: dummyPost2.uri, indexedAt: dummyPost2.indexedAt }],
        },
        {
          feed: dummyFeed1.uri,
          posts: [{ uri: dummyPost3.uri, indexedAt: dummyPost3.indexedAt }],
        },
      ];

      const { response, json } = await batchRemovePosts(entries);
      assertValidResponse(response);

      expect(json.results).toHaveLength(3);
      expect(json.results![0].feed).toBe(dummyFeed1.uri);
      expect(json.results![1].feed).toBe(dummyFeed1.uri);
      expect(json.results![2].feed).toBe(dummyFeed1.uri);

      expect(json.results![0].results).toHaveLength(1);
      expect(json.results![0].results[0].uri).toBe(dummyPost1.uri);
      expect(json.results![0].results[0].status).toBe('removed');

      expect(json.results![1].results).toHaveLength(1);
      expect(json.results![1].results[0].uri).toBe(dummyPost2.uri);
      expect(json.results![1].results[0].status).toBe('removed');

      expect(json.results![2].results).toHaveLength(1);
      expect(json.results![2].results[0].uri).toBe(dummyPost3.uri);
      expect(json.results![2].results[0].status).toBe('removed');

      expect(await verifyPostExists(dummyPost1.uri)).toBe(false);
      expect(await verifyPostExists(dummyPost2.uri)).toBe(false);
      expect(await verifyPostExists(dummyPost3.uri)).toBe(false);
      expect(await verifyPostLanguagesExist(dummyPost1.id)).toBe(false);
      expect(await verifyPostLanguagesExist(dummyPost2.id)).toBe(false);
      expect(await verifyPostLanguagesExist(dummyPost3.id)).toBe(false);
    });

    it('Given post has no indexedAt When batch remove is called Then wildcard deletion is applied', async () => {
      const feedId1 = await insertFeed(dummyFeed1);
      await insertPost(feedId1, dummyPost1);

      expect(await verifyPostLanguagesExist(dummyPost1.id)).toBe(true);

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [{ uri: dummyPost1.uri }],
        },
      ];

      const { response, json } = await batchRemovePosts(entries);
      assertValidResponse(response);

      expect(json.results![0].results[0].status).toBe('removed');
      expect(await verifyPostExists(dummyPost1.uri)).toBe(false);
      expect(await verifyPostLanguagesExist(dummyPost1.id)).toBe(false);
    });

    it('Given post has indexedAt When batch remove is called Then deletion uses the specified indexedAt', async () => {
      const feedId1 = await insertFeed(dummyFeed1);
      await insertPost(feedId1, dummyPost1);

      expect(await verifyPostLanguagesExist(dummyPost1.id)).toBe(true);

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [{ uri: dummyPost1.uri, indexedAt: dummyPost1.indexedAt }],
        },
      ];

      const { response, json } = await batchRemovePosts(entries);
      assertValidResponse(response);

      expect(json.results![0].results[0].status).toBe('removed');
      expect(await verifyPostExists(dummyPost1.uri, dummyPost1.indexedAt)).toBe(false);
      expect(await verifyPostLanguagesExist(dummyPost1.id)).toBe(false);
    });

    it('Given duplicate removal requests for the same post When batch remove is called Then each request returns a result', async () => {
      const feedId1 = await insertFeed(dummyFeed1);
      await insertPost(feedId1, dummyPost1);

      expect(await verifyPostLanguagesExist(dummyPost1.id)).toBe(true);

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [
            { uri: dummyPost1.uri, indexedAt: dummyPost1.indexedAt },
            { uri: dummyPost1.uri, indexedAt: dummyPost1.indexedAt },
          ],
        },
      ];

      const { response, json } = await batchRemovePosts(entries);
      assertValidResponse(response);

      expect(json.results![0].results).toHaveLength(2);
      expect(json.results![0].results[0].status).toBe('removed');
      expect(json.results![0].results[1].status).toBe('removed');
      expect(await verifyPostLanguagesExist(dummyPost1.id)).toBe(false);
    });

    it('Given post has related post_languages When batch remove is called Then cascade deletion removes them', async () => {
      const feedId1 = await insertFeed(dummyFeed1);
      await insertPost(feedId1, dummyPost1);

      expect(await verifyPostLanguagesExist(dummyPost1.id)).toBe(true);

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [{ uri: dummyPost1.uri, indexedAt: dummyPost1.indexedAt }],
        },
      ];

      const { response, json } = await batchRemovePosts(entries);
      assertValidResponse(response);

      expect(json.results![0].results[0].status).toBe('removed');
      expect(await verifyPostLanguagesExist(dummyPost1.id)).toBe(false);
    });

    it('Given posts are provided in mixed order When batch remove is called Then result order matches input', async () => {
      const feedId1 = await insertFeed(dummyFeed1);
      await insertPost(feedId1, dummyPost1);
      await insertPost(feedId1, dummyPost3);

      expect(await verifyPostLanguagesExist(dummyPost1.id)).toBe(true);
      expect(await verifyPostLanguagesExist(dummyPost3.id)).toBe(true);

      const entries = [
        {
          feed: dummyFeed1.uri,
          posts: [
            { uri: dummyPost3.uri, indexedAt: dummyPost3.indexedAt },
            { uri: dummyPost2.uri, indexedAt: dummyPost2.indexedAt },
            { uri: dummyPost1.uri, indexedAt: dummyPost1.indexedAt },
          ],
        },
      ];

      const { response, json } = await batchRemovePosts(entries);
      assertValidResponse(response);

      expect(json.results![0].results).toHaveLength(3);
      expect(json.results![0].results[0].uri).toBe(dummyPost3.uri);
      expect(json.results![0].results[0].status).toBe('removed');
      expect(json.results![0].results[1].uri).toBe(dummyPost2.uri);
      expect(json.results![0].results[1].status).toBe('error');
      expect(json.results![0].results[2].uri).toBe(dummyPost1.uri);
      expect(json.results![0].results[2].status).toBe('removed');

      expect(await verifyPostLanguagesExist(dummyPost3.id)).toBe(false);
      expect(await verifyPostLanguagesExist(dummyPost1.id)).toBe(false);
    });

    it('Given developer mode is toggled on and off When batch remove is called Then logging behavior is toggled', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const feedId1 = await insertFeed(dummyFeed1);
      const feedId2 = await insertFeed(dummyFeed2);
      const post1 = { ...dummyPost1, id: 3001, uri: 'at://did:plc:author1/app.bsky.feed.post/dev-post-1' };
      const post2 = { ...dummyPost2, id: 3002, uri: 'at://did:plc:author2/app.bsky.feed.post/dev-post-2' };
      await insertPost(feedId1, post1);
      await insertPost(feedId2, post2);

      const disabledEntries = [
        {
          feed: dummyFeed1.uri,
          posts: [{ uri: post1.uri, indexedAt: post1.indexedAt }],
        },
      ];
      const enabledEntries = [
        {
          feed: dummyFeed2.uri,
          posts: [{ uri: post2.uri, indexedAt: post2.indexedAt }],
        },
      ];

      const { response: disabledResponse } = await batchRemovePosts(disabledEntries, {
        DEVELOPER_MODE: undefined,
      });
      expect(disabledResponse.status).toBe(200);
      expect(logSpy).not.toHaveBeenCalled();

      logSpy.mockClear();

      const { response: enabledResponse } = await batchRemovePosts(enabledEntries, {
        DEVELOPER_MODE: 'enabled',
      });
      expect(enabledResponse.status).toBe(200);
      expect(logSpy).toHaveBeenCalled();

      const events = logSpy.mock.calls.map(
        (call) => (JSON.parse(call[0] as string) as Record<string, unknown>).event
      );
      expect(events).toContain('db.batch_remove.posts.start');
      expect(events).toContain('db.query.batch_remove_feeds.start');
      expect(events).toContain('db.batch_remove.posts.success');

      logSpy.mockRestore();
    });
  });
});
