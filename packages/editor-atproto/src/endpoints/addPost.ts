import { All_LANGS } from 'shared/src/constants';
import { BadRequestError, InternalServerError, UnknownFeedError } from 'shared/src/errors/core';
import { toGeneratorReason, type EditorReason, type GeneratorReason } from 'shared/src/reason';

import { assertAtUriCollection } from '../validation/atUri';

const SQL_INSERT_POST = `
INSERT INTO posts (feed_id, uri, cid, indexed_at, feed_context, reason)
SELECT feed_id, ?, ?, ?, ?, ?
FROM feeds
WHERE feed_uri = ?
RETURNING post_id`;
const SQL_INSERT_POST_LANG = 'INSERT INTO post_languages (post_id, language) VALUES (?, ?)';

const PRIMARY_LANGUAGE_TAG_PATTERN = /^[a-z]{2,3}$/;

type AddPostInput = {
  feed: string;
  post: {
    uri: string;
    cid: string;
    languages?: string[] | null;
    indexedAt?: string;
    feedContext?: string;
    reason?: EditorReason;
  };
};

function normalizeLanguages(languages?: string[] | null): string[] {
  const normalized = (languages ?? [])
    .map((lang) => lang.trim().toLowerCase())
    .map((lang) => lang.split('-')[0])
    .filter((lang) => lang.length > 0);

  if (normalized.includes(All_LANGS)) {
    return [All_LANGS];
  }
  if (normalized.length === 0) {
    return [All_LANGS];
  }

  const deduped = [...new Set(normalized)];
  if (deduped.some((code) => !(code === All_LANGS || PRIMARY_LANGUAGE_TAG_PATTERN.test(code)))) {
    throw new BadRequestError(
      'All primary language tags must be exactly two or three lowercase alphabetic characters (e.g., "en", "jp").'
    );
  }

  return deduped;
}

function normalizeReason(reason?: EditorReason): GeneratorReason | null {
  if (!reason) {
    return null;
  }

  const generatorReason = toGeneratorReason(reason);
  if (generatorReason.$type === 'app.bsky.feed.defs#skeletonReasonRepost') {
    assertAtUriCollection(generatorReason.repost, 'app.bsky.feed.repost', 'repost URI');
  }

  return generatorReason;
}

export async function addPost(db: Env['DB'], input: AddPostInput): Promise<Response> {
  const feedUri = input.feed;
  const post = input.post;

  assertAtUriCollection(feedUri, 'app.bsky.feed.generator', 'feed URI');
  assertAtUriCollection(post.uri, 'app.bsky.feed.post', 'post URI');

  const languages = normalizeLanguages(post.languages);
  const indexedAt = post.indexedAt
    ? new Date(post.indexedAt).toISOString()
    : new Date().toISOString();
  const reason = normalizeReason(post.reason);

  try {
    const { success: insertSuccess, results } = await db
      .prepare(SQL_INSERT_POST)
      .bind(
        post.uri,
        post.cid,
        indexedAt,
        post.feedContext ?? null,
        reason ? JSON.stringify(reason) : null,
        feedUri
      )
      .all();

    if (!insertSuccess) {
      throw new InternalServerError('Failed to insert post to the database');
    }
    if (results.length === 0) {
      throw new UnknownFeedError(`Feed with URI ${feedUri} does not exist.`);
    }

    const postId = results[0].post_id;
    const addPostLangStmt = languages.map((lang) =>
      db.prepare(SQL_INSERT_POST_LANG).bind(postId, lang)
    );
    const batchResult = await db.batch(addPostLangStmt);
    if (!batchResult.every((result) => result.success)) {
      throw new InternalServerError('Failed to add post languages to DB');
    }
  } catch (error) {
    if (
      error instanceof BadRequestError ||
      error instanceof UnknownFeedError ||
      error instanceof InternalServerError
    ) {
      throw error;
    }
    throw error;
  }

  return Response.json({
    message: 'Post added successfully',
    feed: feedUri,
    post: {
      uri: post.uri,
      cid: post.cid,
      languages,
      indexedAt,
      feedContext: post.feedContext,
      reason: reason ?? undefined,
    },
  });
}
