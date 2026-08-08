import { callProcedure, FEED_URI, resetFeedTables } from './feedTest.shared';

export const ENDPOINT_PATH = '/xrpc/net.nusno.gyoka.feed.unregisterFeed';
export const dummyFeedUri = FEED_URI;

export async function unregisterFeed(input: { uri: string }) {
  return callProcedure(ENDPOINT_PATH, input);
}

export { resetFeedTables };
