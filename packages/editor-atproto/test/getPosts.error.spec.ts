import { beforeEach, describe, expect, it } from 'vitest';

import { FEED_URI } from './feedTest.shared';
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
  });
});
