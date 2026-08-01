import { AUTHOR_DID, callProcedure, FEED_URI, resetFeedTables } from './feedTest.shared';

export const ENDPOINT_PATH = '/xrpc/net.nusno.gyoka.feed.removePostByAuthor';
export const dummyFeedUri = FEED_URI;
export const dummyAuthor = AUTHOR_DID;

export async function removePostByAuthor(input: { feed: string; author: string }) {
  return callProcedure(ENDPOINT_PATH, input);
}

export { resetFeedTables };
