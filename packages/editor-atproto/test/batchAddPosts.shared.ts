import {
  CID,
  callProcedure,
  FEED_URI,
  POST_URI,
  POST_URI_2,
  resetFeedTables,
} from './feedTest.shared';

export const ENDPOINT_PATH = '/xrpc/net.nusno.gyoka.feed.batchAddPosts';
export const dummyEntries = [
  {
    feed: FEED_URI,
    posts: [
      { uri: POST_URI, cid: CID },
      { uri: POST_URI_2, cid: CID },
    ],
  },
];

export async function batchAddPosts(
  input: {
    entries: Array<{
      feed: string;
      posts: Array<{
        uri: string;
        cid: string;
        languages?: string[];
        reason?: { $type: string; repost?: string };
      }>;
    }>;
  },
  envOverrides?: Partial<Env & { MAX_BATCH_POSTS?: string }>
) {
  return callProcedure(ENDPOINT_PATH, input, envOverrides as Partial<Env>);
}

export { resetFeedTables };
