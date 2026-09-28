import { BadRequestError, InternalServerError, UnknownFeedError } from 'shared/src/errors/core';
import { toEditorReason, type EditorReason } from 'shared/src/reason';

import { assertAtUriCollection } from '../validation/atUri';

const SQL_SELECT_POSTS = `
SELECT 
  p.post_id,
    p.uri, 
    p.cid, 
    p.indexed_at, 
    p.reason,
    p.feed_context,
    GROUP_CONCAT(pl.language) AS langs
FROM posts p
JOIN post_languages pl ON p.post_id = pl.post_id
WHERE p.feed_id = ?
    AND (? IS NULL OR p.uri = ?)
    AND (? IS NULL OR p.cid = ?)
    AND (? IS NULL OR p.indexed_at = ?)
    AND (
      ? IS NULL
      OR p.indexed_at < ?
      OR (
        p.indexed_at = ?
        AND (
          p.cid < ?
          OR (p.cid = ? AND p.post_id < ?)
        )
      )
    )
GROUP BY pl.post_id
ORDER BY p.indexed_at DESC, p.cid DESC, p.post_id DESC
LIMIT ?`;

type GetPostsInput = {
  feed?: string;
  uri?: string;
  cid?: string;
  indexedAt?: string;
  limit?: number;
  cursor?: string;
};

type SearchConditions = {
  feed: string;
  uri?: string;
  cid?: string;
  indexedAt?: string;
};

type PostsCursor = {
  version: 1;
  conditions: SearchConditions;
  position: {
    indexedAt: string;
    cid: string;
    postId: number;
  };
};

export async function getPosts(db: Env['DB'], input: GetPostsInput): Promise<Response> {
  const limit = input.limit ?? 1000;
  const requestConditions = normalizeSearchConditions(input);
  const cursor = input.cursor ? parseCursor(input.cursor) : undefined;
  const conditions = resolveSearchConditions(requestConditions, cursor);
  const cursorPosition = cursor?.position;

  const { success: feedCheckSuccess, results: feedResults } = await db
    .prepare('SELECT feed_id FROM feeds WHERE feed_uri = ?')
    .bind(conditions.feed)
    .all();

  if (!feedCheckSuccess) {
    throw new InternalServerError('Failed to query the database');
  }
  if (feedResults.length === 0) {
    throw new UnknownFeedError(`Feed with URI ${conditions.feed} does not exist.`);
  }

  const feedId = feedResults[0].feed_id;

  const { success: postsSuccess, results: postsResults } = await db
    .prepare(SQL_SELECT_POSTS)
    .bind(
      feedId,
      conditions.uri ?? null,
      conditions.uri ?? null,
      conditions.cid ?? null,
      conditions.cid ?? null,
      conditions.indexedAt ?? null,
      conditions.indexedAt ?? null,
      cursorPosition?.indexedAt ?? null,
      cursorPosition?.indexedAt ?? null,
      cursorPosition?.indexedAt ?? null,
      cursorPosition?.cid ?? null,
      cursorPosition?.cid ?? null,
      cursorPosition?.postId ?? null,
      limit
    )
    .all();

  if (!postsSuccess) {
    throw new InternalServerError('Failed to fetch posts');
  }

  const nextCursor =
    postsResults.length === limit
      ? createCursor({
          version: 1,
          conditions,
          position: {
            indexedAt: postsResults[postsResults.length - 1].indexed_at as string,
            cid: postsResults[postsResults.length - 1].cid as string,
            postId: postsResults[postsResults.length - 1].post_id as number,
          },
        })
      : undefined;

  return Response.json({
    feed: conditions.feed,
    posts: postsResults.map((post) => {
      const values = ((post.langs as string) || '')
        .split(',')
        .map((lang) => lang.trim().toLowerCase())
        .filter((lang) => lang.length > 0);
      const normalizedLanguages = values.includes('*') || values.length === 0 ? ['*'] : values;

      return {
        uri: post.uri,
        cid: post.cid,
        languages: normalizedLanguages,
        langs: normalizedLanguages,
        indexedAt: post.indexed_at,
        reason: post.reason ? parseEditorReason(post.reason as string) : undefined,
        feedContext: post.feed_context ?? undefined,
      };
    }),
    cursor: nextCursor,
  });
}

function normalizeSearchConditions(input: GetPostsInput): Partial<SearchConditions> {
  if (input.feed) {
    assertAtUriCollection(input.feed, 'app.bsky.feed.generator', 'feed URI');
  }
  if (input.uri) {
    assertAtUriCollection(input.uri, 'app.bsky.feed.post', 'post URI');
  }

  return {
    feed: input.feed,
    uri: input.uri,
    cid: input.cid,
    indexedAt: input.indexedAt ? normalizeIndexedAt(input.indexedAt) : undefined,
  };
}

function normalizeIndexedAt(indexedAt: string): string {
  const date = new Date(indexedAt);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestError('Invalid indexedAt');
  }
  return date.toISOString();
}

function resolveSearchConditions(
  requestConditions: Partial<SearchConditions>,
  cursor?: PostsCursor
): SearchConditions {
  if (!cursor) {
    if (!requestConditions.feed) {
      throw new BadRequestError('Feed is required when cursor is omitted');
    }
    return requestConditions as SearchConditions;
  }

  for (const key of ['feed', 'uri', 'cid', 'indexedAt'] as const) {
    if (requestConditions[key] !== undefined && requestConditions[key] !== cursor.conditions[key]) {
      throw new BadRequestError('Cursor search conditions do not match request parameters');
    }
  }

  return cursor.conditions;
}

function createCursor(cursor: PostsCursor): string {
  return btoa(JSON.stringify(cursor)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function parseCursor(value: string): PostsCursor {
  try {
    const padded =
      value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4);
    const cursor = JSON.parse(atob(padded)) as PostsCursor;
    const { conditions, position } = cursor;
    if (
      cursor.version !== 1 ||
      !conditions ||
      typeof conditions.feed !== 'string' ||
      (conditions.uri !== undefined && typeof conditions.uri !== 'string') ||
      (conditions.cid !== undefined && typeof conditions.cid !== 'string') ||
      (conditions.indexedAt !== undefined && typeof conditions.indexedAt !== 'string') ||
      !position ||
      typeof position.indexedAt !== 'string' ||
      typeof position.cid !== 'string' ||
      !Number.isInteger(position.postId)
    ) {
      throw new Error('Invalid cursor');
    }

    assertAtUriCollection(conditions.feed, 'app.bsky.feed.generator', 'feed URI');
    if (conditions.uri) {
      assertAtUriCollection(conditions.uri, 'app.bsky.feed.post', 'post URI');
    }
    normalizeIndexedAt(conditions.indexedAt ?? position.indexedAt);
    return cursor;
  } catch {
    throw new BadRequestError('Malformed cursor');
  }
}

function parseEditorReason(reason: string) {
  try {
    return toEditorReason(JSON.parse(reason) as EditorReason);
  } catch {
    return undefined;
  }
}
