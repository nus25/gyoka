import { callProcedure, FEED_URI, resetFeedTables } from './feedTest.shared';

export const ENDPOINT_PATH = '/xrpc/net.nusno.gyoka.feed.trimFeed';
export const dummyFeedUri = FEED_URI;

export async function trimFeed(input: { feed: string; remain: number }) {
  return callProcedure(ENDPOINT_PATH, input);
}

export { resetFeedTables };
