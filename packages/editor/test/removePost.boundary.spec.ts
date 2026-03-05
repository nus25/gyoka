import { describe, it, expect, beforeEach } from 'vitest';

import {
  ENDPOINT_PATH,
  dummyFeed,
  dummyPost,
  insertFeed,
  insertPost,
  removePost,
  resetRemovePostTables,
  verifyPostExists,
  verifyPostLanguagesExist,
} from './removePost.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetRemovePostTables();
  });

  describe('Boundary cases', () => {
    it('Given indexedAt is specified but does not match When remove is called Then post remains and not found is returned', async () => {
      const feedId = await insertFeed(dummyFeed);
      await insertPost(feedId, dummyPost);
      expect(await verifyPostLanguagesExist(dummyPost.id)).toBe(true);

      const wrongDate = new Date();
      wrongDate.setFullYear(wrongDate.getFullYear() - 1);

      const { response } = await removePost(dummyFeed.uri, {
        uri: dummyPost.uri,
        indexedAt: wrongDate.toISOString(),
      });
      expect(response.status).toBe(404);

      const exists = await verifyPostExists(dummyPost.uri);
      expect(exists).toBe(true);
      expect(await verifyPostLanguagesExist(dummyPost.id)).toBe(true);
    });
  });
});
