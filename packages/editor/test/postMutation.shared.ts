import { env } from 'cloudflare:workers';

import type { JsonObject } from './feedTest.shared';

export const PUT_PATH = '/xrpc/net.nusno.gyoka.feed.putPosts';
export const MOVE_PATH = '/xrpc/net.nusno.gyoka.feed.movePosts';
export const PRUNE_BEFORE_PATH = '/xrpc/net.nusno.gyoka.feed.prunePostsBefore';
export const REMOVE_PATH = '/xrpc/net.nusno.gyoka.feed.removePosts';
export const REMOVE_BY_AUTHOR_PATH = '/xrpc/net.nusno.gyoka.feed.removePostsByAuthor';
export const REBALANCE_PATH = '/xrpc/net.nusno.gyoka.feed.rebalanceOrder';
export const TRIM_PATH = '/xrpc/net.nusno.gyoka.feed.trimPosts';
export const POST_ONE = 'at://did:plc:author/app.bsky.feed.post/one';
export const POST_TWO = 'at://did:plc:author/app.bsky.feed.post/two';

export function resultActions(json: JsonObject): string[] {
  return (json.results as Array<{ action: string }>).map((result) => result.action);
}

export async function orderedUris(feedId: number): Promise<string[]> {
  const { results } = await env.DB.prepare(
    'SELECT uri FROM posts WHERE feed_id = ? ORDER BY order_rank ASC'
  )
    .bind(feedId)
    .all<{ uri: string }>();
  return results.map((row) => row.uri);
}

export async function findOrderRevision(feedId: number): Promise<number> {
  const row = await env.DB.prepare('SELECT order_revision FROM feeds WHERE feed_id = ?')
    .bind(feedId)
    .first<{ order_revision: number }>();
  return row!.order_revision;
}
