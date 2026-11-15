import { callQuery, FEED_URI, resetFeedTables } from './feedTest.shared';

export const ENDPOINT_PATH = '/xrpc/net.nusno.gyoka.feed.listPosts';

export async function listPosts(
  input: {
    feed?: string;
    uri?: string;
    author?: string;
    limit?: number;
    cursor?: string;
  },
  envOverrides?: Partial<Env>
) {
  const params = new URLSearchParams();
  if (input.feed) params.set('feed', input.feed);
  if (input.uri) params.set('uri', input.uri);
  if (input.author) params.set('author', input.author);
  if (input.limit !== undefined) params.set('limit', String(input.limit));
  if (input.cursor) params.set('cursor', input.cursor);

  return callQuery(`${ENDPOINT_PATH}?${params.toString()}`, envOverrides);
}

export { FEED_URI, resetFeedTables };
