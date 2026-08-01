import { callProcedure, FEED_URI, POST_URI, resetFeedTables } from './feedTest.shared';

export const ENDPOINT_PATH = '/xrpc/net.nusno.gyoka.feed.removePost';
export const dummyFeedUri = FEED_URI;
export const dummyPostUri = POST_URI;

export async function removePost(input: {
  feed: string;
  post: { uri: string; indexedAt?: string };
}) {
  return callProcedure(ENDPOINT_PATH, input);
}

export { resetFeedTables };
