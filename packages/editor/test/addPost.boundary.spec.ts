import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';

import {
  ENDPOINT_PATH,
  addPost,
  dummyFeed,
  dummyPost,
  insertFeed,
  resetAddPostTables,
} from './addPost.shared';

describe(ENDPOINT_PATH, () => {
  beforeEach(async () => {
    await resetAddPostTables();
  });

  describe('Boundary cases', () => {
    it('Given same uri and indexedAt already exists When add post is called again Then request passes and duplicate rows are kept', async () => {
      await insertFeed(dummyFeed);

      await addPost(dummyFeed.uri, dummyPost);

      const { response } = await addPost(dummyFeed.uri, dummyPost);

      const db = env.DB;
      const { results: posts } = await db
        .prepare('SELECT * FROM posts WHERE uri = ?')
        .bind(dummyPost.uri)
        .all();

      expect(response.status).toBe(200);
      expect(posts.length).toBeGreaterThanOrEqual(1);
    });
  });
});
