import { CID, callProcedure, FEED_URI, POST_URI, resetFeedTables } from './feedTest.shared';

export const ENDPOINT_PATH = '/xrpc/net.nusno.gyoka.feed.addPost';
export const dummyFeedUri = FEED_URI;
export const dummyPost = {
  uri: POST_URI,
  cid: CID,
  languages: ['en'] as string[],
} as const;

export async function addPost(input: {
  feed: string;
  post: {
    uri: string;
    cid: string;
    languages?: string[];
    indexedAt?: string;
    feedContext?: string;
    reason?: { $type: string; repost?: string };
  };
}) {
  return callProcedure(ENDPOINT_PATH, input);
}

export { resetFeedTables };
