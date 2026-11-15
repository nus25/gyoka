import {
  BadRequestError,
  InternalServerError,
  RevisionConflictError,
  UnknownFeedError,
} from 'shared/src/errors/core';
import { toEditorReason, type EditorReason } from 'shared/src/reason';

import { assertAtUriCollection } from '../validation/atUri';

type ListPostsInput = {
  feed?: string;
  uri?: string;
  author?: string;
  limit?: number;
  cursor?: string;
};

type SearchConditions = {
  feed: string;
  uri?: string;
  author?: string;
};

type PostsCursor = {
  version: 3;
  conditions: SearchConditions;
  orderRevision: number;
  position: { orderRank: string };
};

type FeedRow = {
  feed_id: number;
  order_revision: number;
};

type PostRow = {
  post_id: number;
  uri: string;
  cid: string;
  indexed_at: string;
  reason: string | null;
  langs: string | null;
  order_rank: string;
};

const POST_FIELDS = `
  p.post_id,
  p.uri,
  p.cid,
  p.indexed_at,
  p.reason,
  p.order_rank,
  GROUP_CONCAT(pl.language) AS langs`;

const POST_FILTERS = `
  p.feed_id = ?
  AND (? IS NULL OR p.uri = ?)
  AND (? IS NULL OR p.uri LIKE ? ESCAPE '\\')`;

const SQL_SELECT_POSTS = `
SELECT ${POST_FIELDS}
FROM posts p
LEFT JOIN post_languages pl ON p.post_id = pl.post_id
WHERE ${POST_FILTERS}
  AND (? IS NULL OR p.order_rank < ? COLLATE BINARY)
GROUP BY p.post_id
ORDER BY p.order_rank DESC
LIMIT ?`;

export async function listPosts(
  db: Env['DB'],
  input: ListPostsInput,
  context?: Record<string, unknown>
): Promise<Response> {
  const limit = input.limit ?? 1000;
  if (context) context.stage = 'validation';
  const requestConditions = normalizeSearchConditions(input);
  const cursor = input.cursor ? parseCursor(input.cursor) : undefined;
  const conditions = resolveSearchConditions(requestConditions, cursor);
  if (context)
    Object.assign(context, {
      feed: conditions.feed,
      hasAuthor: !!conditions.author,
      hasUri: !!conditions.uri,
      stage: 'read',
    });
  const feed = await getFeed(db, conditions.feed);
  if (context) context.orderRevision = feed.order_revision;

  if (cursor && cursor.orderRevision !== feed.order_revision) {
    throw new RevisionConflictError('The feed revision changed.');
  }

  const posts = await selectPosts(db, feed.feed_id, conditions, cursor, limit);
  const nextCursor = createNextCursor(feed, conditions, posts, limit);
  if (context) Object.assign(context, { resultCount: posts.length, hasNextCursor: !!nextCursor });

  return Response.json({
    feed: conditions.feed,
    orderRevision: feed.order_revision,
    posts: posts.map(toPostView),
    cursor: nextCursor,
  });
}

async function getFeed(db: Env['DB'], feedUri: string): Promise<FeedRow> {
  const result = await db
    .prepare('SELECT feed_id, order_revision FROM feeds WHERE feed_uri = ?')
    .bind(feedUri)
    .first<FeedRow>();
  if (!result) throw new UnknownFeedError(`Feed with URI ${feedUri} does not exist.`);
  return result;
}

async function selectPosts(
  db: Env['DB'],
  feedId: number,
  conditions: SearchConditions,
  cursor: PostsCursor | undefined,
  limit: number
): Promise<PostRow[]> {
  const position = cursor?.position;
  return selectPostRows(db, feedId, conditions, [
    position?.orderRank ?? null,
    position?.orderRank ?? null,
    limit,
  ]);
}

async function selectPostRows(
  db: Env['DB'],
  feedId: number,
  conditions: SearchConditions,
  cursorBindings: Array<string | number | null>
): Promise<PostRow[]> {
  const authorPrefix = conditions.author
    ? `${escapeLike(`at://${conditions.author}/app.bsky.feed.post/`)}%`
    : null;
  const { success, results } = await db
    .prepare(SQL_SELECT_POSTS)
    .bind(
      feedId,
      conditions.uri ?? null,
      conditions.uri ?? null,
      authorPrefix,
      authorPrefix,
      ...cursorBindings
    )
    .all<PostRow>();
  if (!success) throw new InternalServerError('Failed to fetch posts.');
  return results;
}

function normalizeSearchConditions(input: ListPostsInput): Partial<SearchConditions> {
  if (input.feed) assertAtUriCollection(input.feed, 'app.bsky.feed.generator', 'feed URI');
  if (input.uri) assertAtUriCollection(input.uri, 'app.bsky.feed.post', 'post URI');
  if (input.author) assertDid(input.author);
  if (input.uri && input.author && getAuthority(input.uri) !== input.author) {
    throw new BadRequestError('Post URI author does not match author filter.');
  }
  return { feed: input.feed, uri: input.uri, author: input.author };
}

function resolveSearchConditions(
  requestConditions: Partial<SearchConditions>,
  cursor?: PostsCursor
): SearchConditions {
  if (!cursor) {
    if (!requestConditions.feed)
      throw new BadRequestError('Feed is required when cursor is omitted.');
    return requestConditions as SearchConditions;
  }
  for (const key of ['feed', 'uri', 'author'] as const) {
    if (requestConditions[key] !== undefined && requestConditions[key] !== cursor.conditions[key]) {
      throw new BadRequestError('Cursor search conditions do not match request parameters.');
    }
  }
  return cursor.conditions;
}

function createNextCursor(
  feed: FeedRow,
  conditions: SearchConditions,
  posts: PostRow[],
  limit: number
): string | undefined {
  if (posts.length !== limit) return undefined;
  const last = posts[posts.length - 1]!;
  return createCursor({
    version: 3,
    conditions,
    orderRevision: feed.order_revision,
    position: { orderRank: last.order_rank },
  });
}

function toPostView(post: PostRow) {
  const languages = (post.langs ?? '')
    .split(',')
    .map((language) => language.trim().toLowerCase())
    .filter(Boolean);
  return {
    uri: post.uri,
    cid: post.cid,
    languages: languages.includes('*') || languages.length === 0 ? ['*'] : languages,
    indexedAt: post.indexed_at,
    reason: post.reason ? parseEditorReason(post.reason) : undefined,
  };
}

function parseCursor(value: string): PostsCursor {
  try {
    const padded =
      value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4);
    const cursor = JSON.parse(atob(padded)) as Partial<PostsCursor>;
    if (cursor.version !== 3 || !isSearchConditions(cursor.conditions)) {
      throw new Error('Invalid cursor');
    }
    if (isPostsCursor(cursor)) return cursor;
    throw new Error('Invalid cursor');
  } catch {
    throw new BadRequestError('Malformed cursor.');
  }
}

function isSearchConditions(value: unknown): value is SearchConditions {
  if (!value || typeof value !== 'object') return false;
  const conditions = value as Partial<SearchConditions>;
  if (typeof conditions.feed !== 'string') return false;
  assertAtUriCollection(conditions.feed, 'app.bsky.feed.generator', 'feed URI');
  if (conditions.uri) assertAtUriCollection(conditions.uri, 'app.bsky.feed.post', 'post URI');
  if (conditions.author) assertDid(conditions.author);
  return true;
}

function isPostsCursor(cursor: Partial<PostsCursor>): cursor is PostsCursor {
  return (
    typeof cursor.orderRevision === 'number' &&
    Number.isInteger(cursor.orderRevision) &&
    cursor.orderRevision >= 0 &&
    !!cursor.position &&
    typeof cursor.position.orderRank === 'string'
  );
}

function createCursor(cursor: PostsCursor): string {
  return btoa(JSON.stringify(cursor)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function assertDid(value: string) {
  if (!/^did:[a-z0-9]+:[A-Za-z0-9._:%-]+$/.test(value)) {
    throw new BadRequestError('Invalid author DID.');
  }
}

function getAuthority(uri: string): string {
  return uri.slice('at://'.length, uri.indexOf('/', 'at://'.length));
}

function escapeLike(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
}

function parseEditorReason(reason: string) {
  try {
    return toEditorReason(JSON.parse(reason) as EditorReason);
  } catch {
    return undefined;
  }
}
