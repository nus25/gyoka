import { callQuery, FEED_URI, resetFeedTables } from './feedTest.shared';

export const ENDPOINT_PATH = '/xrpc/net.nusno.gyoka.feed.getPosts';
export const dummyFeedUri = FEED_URI;

export async function getPosts(input: {
  feed?: string;
  uri?: string;
  cid?: string;
  indexedAt?: string;
  limit?: number;
  cursor?: string;
}) {
  const params = new URLSearchParams();
  if (input.feed) {
    params.set('feed', input.feed);
  }
  if (input.uri) {
    params.set('uri', input.uri);
  }
  if (input.cid) {
    params.set('cid', input.cid);
  }
  if (input.indexedAt) {
    params.set('indexedAt', input.indexedAt);
  }
  if (input.limit !== undefined) {
    params.set('limit', String(input.limit));
  }
  if (input.cursor) {
    params.set('cursor', input.cursor);
  }

  return callQuery(`${ENDPOINT_PATH}?${params.toString()}`);
}

export { resetFeedTables };
