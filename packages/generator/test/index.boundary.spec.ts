import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { requestPath } from './index.shared';

describe('Boundary cases', () => {
  beforeEach(async () => {
    await env.DB.prepare('DELETE FROM posts').run();
  });

  it('Given empty posts table When requesting describeFeedGenerator Then it still returns 200', async () => {
    const response = await requestPath('/xrpc/app.bsky.feed.describeFeedGenerator');

    expect(response.status).toBe(200);
  });
});
