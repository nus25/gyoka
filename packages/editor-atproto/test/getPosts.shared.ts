import { callQuery, FEED_URI, resetFeedTables } from './feedTest.shared';

export const ENDPOINT_PATH = '/xrpc/net.nusno.gyoka.feed.getPosts';
export const dummyFeedUri = FEED_URI;

export async function getPosts(input: { feed: string; limit?: number; cursor?: string }) {
  const params = new URLSearchParams();
  params.set('feed', input.feed);
  if (input.limit !== undefined) {
    params.set('limit', String(input.limit));
  }
  if (input.cursor) {
    params.set('cursor', input.cursor);
  }

  return callQuery(`${ENDPOINT_PATH}?${params.toString()}`);
}

export { resetFeedTables };
