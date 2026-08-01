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
  });
});
