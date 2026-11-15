import type { Logger } from 'shared/src/logger';

import { isDid, parseResourceUri } from '@atcute/lexicons/syntax';
import { BadRequestError, InternalServerError, UnknownFeedError } from 'shared/src/errors/core';
import { createLogger } from 'shared/src/logger';

const MAX_ACCEPT_LANGUAGE_CODES = 10;
const logger = createLogger({ service: 'generator', minLevel: 'debug' });

type SkeletonCursor = {
  version: 3;
  feed: string;
  orderRank: string;
};

const SQL_POST_FIELDS = 'p.uri, p.cid, p.indexed_at, p.order_rank, p.reason';

const SQL_SELECT_POST_BASE = `
SELECT ${SQL_POST_FIELDS}
FROM feeds f
INNER JOIN posts p ON p.feed_id = f.feed_id
WHERE f.feed_uri = ?
  AND f.is_active = 1
  AND (? IS NULL OR p.order_rank < ? COLLATE BINARY)
  AND (
    f.lang_filter = 0
    OR __LANG_FILTER_CLAUSE__
  )
ORDER BY p.order_rank DESC
LIMIT ?`;

const SQL_LANG_FILTER_CLAUSES = Array.from({ length: MAX_ACCEPT_LANGUAGE_CODES + 1 }, (_, count) =>
  count === 0
    ? '1=1'
    : `EXISTS (
         SELECT 1
         FROM post_languages pl
         WHERE pl.post_id = p.post_id
           AND pl.language IN (${Array.from({ length: count }, () => '?').join(',')}, "*")
       )`
);

const SQL_SELECT_POST_BY_LANG_COUNT = SQL_LANG_FILTER_CLAUSES.map((langFilterClause) =>
  SQL_SELECT_POST_BASE.replace('__LANG_FILTER_CLAUSE__', langFilterClause)
);

export function extractLanguageCodes(acceptLanguage: string): string[] {
  if (!acceptLanguage) return [];

  const seen = new Set<string>();
  const languageCodes: string[] = [];
  let start = 0;
  for (
    let index = 0;
    index <= acceptLanguage.length && languageCodes.length < MAX_ACCEPT_LANGUAGE_CODES;
    index++
  ) {
    if (index !== acceptLanguage.length && acceptLanguage.charCodeAt(index) !== 44) continue;
    const token = acceptLanguage.slice(start, index);
    start = index + 1;
    const lang = token.slice(0, token.indexOf(';') === -1 ? token.length : token.indexOf(';'));
    const trimmed = lang.trim();
    const primary = trimmed
      .slice(0, trimmed.indexOf('-') === -1 ? trimmed.length : trimmed.indexOf('-'))
      .toLowerCase();
    if (primary && !seen.has(primary)) {
      seen.add(primary);
      languageCodes.push(primary);
    }
  }
  return languageCodes;
}

function assertFeedUri(feed: string): void {
  let parsed: ReturnType<typeof parseResourceUri>;
  try {
    parsed = parseResourceUri(feed);
  } catch (error) {
    if (error instanceof SyntaxError) throw new BadRequestError('Invalid feed URI format');
    throw error;
  }
  if (parsed.collection !== 'app.bsky.feed.generator' || !parsed.rkey) {
    throw new BadRequestError('Invalid feed URI format');
  }
  if (!isDid(parsed.repo)) throw new BadRequestError('DID-based AT URI is required');
}

type GetFeedSkeletonArgs = {
  env: Env;
  request: Request;
  feed: string;
  limit: number;
  cursor?: string;
  context?: Record<string, unknown>;
  logger?: Logger;
};

export async function getFeedSkeleton({
  env,
  request,
  feed,
  limit,
  cursor,
  context,
  logger: requestLogger,
}: GetFeedSkeletonArgs): Promise<Response> {
  assertFeedUri(feed);
  if (context) context.feed = feed;
  const db = env.D1_USE_SESSION === 'enabled' ? env.DB.withSession() : env.DB;
  const parsedCursor = cursor ? parseCursor(cursor) : undefined;
  if (parsedCursor && parsedCursor.feed !== feed) {
    throw new BadRequestError('Cursor does not match the requested feed.');
  }

  const languageCodes = extractLanguageCodes(request.headers.get('Accept-Language') || '');
  if (context) Object.assign(context, { stage: 'read', languageCount: languageCodes.length });
  const posts = await selectPosts(
    db,
    feed,
    parsedCursor,
    languageCodes,
    limit,
    env.DEVELOPER_MODE === 'enabled'
  );
  if (posts.length === 0) await assertFeedExists(db, feed);
  const nextCursor =
    posts.length === limit ? createCursor(feed, posts[posts.length - 1]!) : undefined;
  if (context) Object.assign(context, { resultCount: posts.length, hasNextCursor: !!nextCursor });
  if (env.DEVELOPER_MODE === 'enabled') requestLogger?.debug('feed.get.skeleton.success', context);

  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (languageCodes.length > 0) headers.set('Content-Language', languageCodes.join(', '));
  return new Response(
    JSON.stringify({
      cursor: nextCursor,
      feed: posts.map((post) => ({
        post: post.uri,
        reason: post.reason ? JSON.parse(post.reason as string) : undefined,
      })),
    }),
    { status: 200, headers }
  );
}

async function selectPosts(
  db: D1Database | D1DatabaseSession,
  feed: string,
  cursor: SkeletonCursor | undefined,
  languageCodes: string[],
  limit: number,
  isDevMode: boolean
) {
  const sql = SQL_SELECT_POST_BY_LANG_COUNT[languageCodes.length]!;
  const bindings = [feed, cursor?.orderRank ?? null, cursor?.orderRank ?? null];
  if (isDevMode) {
    logger.debug('db.query.skeleton.start', {
      languageCount: languageCodes.length,
      hasCursor: !!cursor,
      limit,
    });
  }
  const result = await db
    .prepare(sql)
    .bind(...bindings, ...languageCodes, limit)
    .all();
  if (!result.success) throw new InternalServerError('Failed to fetch feed skeleton');
  return result.results;
}

async function assertFeedExists(db: D1Database | D1DatabaseSession, feed: string): Promise<void> {
  const result = await db
    .prepare('SELECT 1 FROM feeds WHERE feed_uri = ? LIMIT 1')
    .bind(feed)
    .all();
  if (!result.success) throw new InternalServerError('Failed to check feed existence');
  if (result.results.length === 0)
    throw new UnknownFeedError(`Feed with URI ${feed} does not exist.`);
}

function parseCursor(value: string): SkeletonCursor {
  try {
    const padded =
      value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4);
    const cursor = JSON.parse(atob(padded)) as Partial<SkeletonCursor>;
    if (
      cursor.version !== 3 ||
      typeof cursor.feed !== 'string' ||
      typeof cursor.orderRank !== 'string'
    ) {
      throw new Error('Invalid cursor');
    }
    return cursor as SkeletonCursor;
  } catch {
    throw new BadRequestError('Malformed cursor');
  }
}

function createCursor(feed: string, post: Record<string, unknown>): string {
  const cursor = { version: 3, feed, orderRank: post.order_rank };
  return btoa(JSON.stringify(cursor)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
