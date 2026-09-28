import { callProcedure, FEED_URI, resetFeedTables } from './feedTest.shared';

export const ENDPOINT_PATH = '/xrpc/net.nusno.gyoka.feed.trimFeedBefore';
export const dummyFeedUri = FEED_URI;

export async function trimFeedBefore(input: { feed: string; before: string }) {
  return callProcedure(ENDPOINT_PATH, input);
}

export { resetFeedTables };