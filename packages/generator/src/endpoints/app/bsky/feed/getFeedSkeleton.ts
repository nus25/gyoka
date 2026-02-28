import { parseResourceUri, isDid } from '@atcute/lexicons/syntax';
import { InternalServerError, BadRequestError, UnknownFeedError } from 'shared/src/errors/core';
import { createLogger } from 'shared/src/logger';

// https://github.com/bluesky-social/atproto/blob/main/lexicons/app/bsky/feed/getFeedSkeleton.json

const MAX_ACCEPT_LANGUAGE_CODES = 10;
const logger = createLogger({ service: 'generator', minLevel: 'debug' });
export function extractLanguageCodes(acceptLanguage: string): string[] {
  if (!acceptLanguage) return [];

  const maxCount = MAX_ACCEPT_LANGUAGE_CODES;
  const seen = new Set<string>();
  const parts = acceptLanguage.split(',');

  for (let i = 0; i < parts.length && seen.size < maxCount; i++) {
    const semicolonPos = parts[i].indexOf(';');
    const lang = semicolonPos === -1 ? parts[i] : parts[i].substring(0, semicolonPos);
    const trimmed = lang.trim();
    const dashPos = trimmed.indexOf('-');
    const langCode = (dashPos === -1 ? trimmed : trimmed.substring(0, dashPos)).toLowerCase();

    if (langCode) {
      seen.add(langCode);
    }
  }

  return Array.from(seen);
}

function assertFeedUri(feed: string): void {
  const parsed = parseResourceUri(feed);
  if (!parsed.ok || parsed.value.collection !== 'app.bsky.feed.generator' || !parsed.value.rkey) {
    throw new BadRequestError('Invalid feed URI format');
  }
  if (!isDid(parsed.value.repo)) {
    throw new BadRequestError('DID-based AT URI is required');
  }
}

type GetFeedSkeletonArgs = {
  env: Env;
  request: Request;
  feed: string;
  limit: number;
  cursor?: string;
};

export async function getFeedSkeleton({
  env,
  request,
  feed,
  limit,
  cursor,
}: GetFeedSkeletonArgs): Promise<Response> {
  assertFeedUri(feed);

  let cursorIndexedAt: string | null = null;
  let cursorCid: string | null = null;
  if (cursor) {
    const cursorParts = cursor.split('::');
    if (
      cursorParts.length !== 2 ||
      cursorParts.some((part) => part === '') ||
      Number.isNaN(parseInt(cursorParts[0], 10))
    ) {
      throw new BadRequestError('Malformed cursor');
    }
    cursorIndexedAt = new Date(parseInt(cursorParts[0], 10)).toISOString();
    cursorCid = cursorParts[1];
  }

  const acceptLanguage = request.headers.get('Accept-Language') || '';
  const languageCodes = extractLanguageCodes(acceptLanguage);

  const SQL_TEMPLATE_SELECT_POST = `
SELECT p.uri, p.cid, p.indexed_at, p.reason, p.feed_context
FROM feeds f
INNER JOIN posts p ON p.feed_id = f.feed_id
WHERE f.feed_uri = ?
  AND f.is_active = 1
  AND (
    ? IS NULL
    OR (
      p.indexed_at < ?
      OR (
        p.indexed_at = ?
        AND p.cid < ?
      )
    )
  )
  AND (
    f.lang_filter = 0
    OR ${
      languageCodes.length === 0
        ? '1=1'
        : `EXISTS (
            SELECT 1
            FROM post_languages pl
            WHERE pl.post_id = p.post_id
              AND pl.language IN (${languageCodes.map(() => '?').join(',')}, "*")
          )`
    }
  )
ORDER BY p.indexed_at DESC, p.cid DESC, p.post_id DESC
LIMIT ?;`;

  if (env.DEVELOPER_MODE === 'enabled') {
    logger.debug('db.query.feed_skeleton.start', {
      query: SQL_TEMPLATE_SELECT_POST,
      bindings: [
        feed,
        cursor || null,
        cursorIndexedAt,
        cursorIndexedAt,
        cursorCid,
        ...languageCodes,
        limit,
      ],
    });
  }

  const { success, results } = await env.DB.prepare(SQL_TEMPLATE_SELECT_POST)
    .bind(
      feed,
      cursor || null,
      cursorIndexedAt,
      cursorIndexedAt,
      cursorCid,
      ...languageCodes,
      limit
    )
    .all();

  if (!success) {
    throw new InternalServerError('Failed to fetch feed skeleton');
  }

  if (results.length === 0) {
    const feedExistsQuery = `
      SELECT feed_id
      FROM feeds
      WHERE feed_uri = ?
        AND is_active = 1
      LIMIT 1;`;
    const feedExistsResult = await env.DB.prepare(feedExistsQuery).bind(feed).all();
    if (!feedExistsResult.success) {
      throw new InternalServerError('Failed to verify feed existence');
    }
    if (env.DEVELOPER_MODE === 'enabled') {
      logger.debug('db.query.feed_exists.success', {
        feedUri: feed,
        success: feedExistsResult.success,
        resultCount: feedExistsResult.results.length,
        rowsRead: feedExistsResult.meta?.rows_read,
      });
    }
    if (!feedExistsResult.results[0]?.feed_id) {
      throw new UnknownFeedError(`The feed generator with URI ${feed} does not existed.`);
    }
  }

  const feedItems = results.map((post) => ({
    post: post.uri,
    reason: post.reason ? JSON.parse(post.reason as string) : undefined,
    feedContext: post.feed_context ?? undefined,
  }));

  const nextCursor =
    results.length === limit
      ? `${new Date(results[results.length - 1].indexed_at as string).getTime()}::${
          results[results.length - 1].cid
        }`
      : undefined;

  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  if (languageCodes.length > 0) {
    headers.set('Content-Language', languageCodes.join(', '));
  }

  return new Response(
    JSON.stringify({
      cursor: nextCursor,
      feed: feedItems,
    }),
    {
      status: 200,
      headers,
    }
  );
}
