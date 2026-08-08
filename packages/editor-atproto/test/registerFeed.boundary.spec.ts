import { beforeEach, describe, expect, it } from 'vitest';

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

  describe('Boundary cases', () => {
    it('Given optional fields are omitted When register feed is called Then default values are applied', async () => {
      const feed = { uri: 'at://did:plc:testuser/app.bsky.feed.generator/feed2' };
      const { response, json } = await registerFeed(feed);

      assertValidResponse(response);
      expect(json).toEqual({
        message: 'Feed registered successfully',
        feed: {
          uri: feed.uri,
          langFilter: true,
          isActive: true,
        },
      });

      const row = await findFeedRowByUri(feed.uri);
      expect(row).toEqual({
        feed_uri: feed.uri,
        lang_filter: 1,
        is_active: 1,
      });
    });
  });
});
