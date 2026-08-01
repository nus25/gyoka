import { callProcedure, FEED_URI, resetFeedTables } from './feedTest.shared';

export const ENDPOINT_PATH = '/xrpc/net.nusno.gyoka.feed.updateFeed';
export const dummyFeedUri = FEED_URI;

export async function updateFeed(input: { uri: string; langFilter?: boolean; isActive?: boolean }) {
  return callProcedure(ENDPOINT_PATH, input);
}

export { resetFeedTables };
