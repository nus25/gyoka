import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  assertValidResponse,
  findFeedRowByUri,
  ENDPOINT_PATH,
  registerFeed,
  resetRegisterFeedTables,
} from './registerFeed.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetRegisterFeedTables();
  });

  describe('Success cases', () => {
    it('Given developer mode When registering a feed Then the debug summary records its settings', async () => {
      const output = vi.spyOn(console, 'log').mockImplementation(() => {});
      try {
        const { response } = await registerFeed(
          { uri: 'at://did:plc:testuser/app.bsky.feed.generator/feed1', langFilter: false },
          { DEVELOPER_MODE: 'enabled' }
        );
        expect(response.status).toBe(200);
        expect(output.mock.calls.map(([line]) => JSON.parse(String(line)))).toContainEqual(
          expect.objectContaining({
            event: 'feed.register.feed.success',
            langFilter: false,
            isActive: true,
          })
        );
      } finally {
        output.mockRestore();
      }
    });

    it('Given all fields are provided When register feed is called Then feed is registered with provided values', async () => {
      const feed = {
        uri: 'at://did:plc:testuser/app.bsky.feed.generator/feed1',
        langFilter: false,
        isActive: true,
      };

      const { response, json } = await registerFeed(feed);

      assertValidResponse(response);
      expect(json).toEqual({
        message: 'Feed registered successfully',
        feed: {
          uri: feed.uri,
          langFilter: feed.langFilter,
          isActive: feed.isActive,
          orderRevision: 0,
        },
      });

      const row = await findFeedRowByUri(feed.uri);
      expect(row).toEqual({
        feed_uri: feed.uri,
        lang_filter: 0,
        is_active: 1,
        order_revision: 0,
      });
    });
  });
});
