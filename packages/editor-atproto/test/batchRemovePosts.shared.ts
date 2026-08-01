import { callProcedure, FEED_URI, POST_URI, POST_URI_2, resetFeedTables } from './feedTest.shared';

export const ENDPOINT_PATH = '/xrpc/net.nusno.gyoka.feed.batchRemovePosts';
export const dummyEntries = [
  {
    feed: FEED_URI,
    posts: [{ uri: POST_URI }, { uri: POST_URI_2 }],
  },
];

export async function batchRemovePosts(
  input: { entries: Array<{ feed: string; posts: Array<{ uri: string; indexedAt?: string }> }> },
  envOverrides?: Partial<Env & { MAX_BATCH_POSTS?: string }>
) {
  return callProcedure(ENDPOINT_PATH, input, envOverrides as Partial<Env>);
}

export { resetFeedTables };
