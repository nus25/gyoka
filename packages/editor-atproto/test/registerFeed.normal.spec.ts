import { beforeEach, describe, expect, it } from 'vitest';

import {
  assertValidResponse,
  ENDPOINT_PATH,
  registerFeed,
  resetRegisterFeedTables,
} from './registerFeed.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetRegisterFeedTables();
  });

  describe('Success cases', () => {
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
        },
      });
    });
  });
});
