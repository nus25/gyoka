import { All_LANGS } from 'shared/src/constants';
import { BadRequestError, InternalServerError } from 'shared/src/errors/core';
import { createLogger } from 'shared/src/logger';

const logger = createLogger({ service: 'editor', minLevel: 'debug' });
const DEFAULT_MAX_BATCH_POSTS = 25;
const PRIMARY_LANGUAGE_TAG_PATTERN = /^[a-z]{2,3}$/;

const SQL_INSERT_POST = `
INSERT INTO posts (feed_id, uri, cid, indexed_at, feed_context, reason) VALUES (?, ?, ?, ?, ?, ?)`;
const SQL_INSERT_POST_LANG = `
INSERT INTO post_languages (post_id, language) SELECT post_id, ? FROM posts WHERE feed_id = ? AND cid = ? AND indexed_at = ? LIMIT 1`;

type PostReason =
  | {
      $type: string;
      repost?: string;
    }
  | {
      $type: string;
      repost?: string;
    };

type PostInput = {
  uri: string;
  cid: string;
  languages?: string[] | null;
  indexedAt?: string;
  feedContext?: string;
  reason?: PostReason;
};

type BatchAddPostsInput = {
  entries: Array<{
    feed: string;
    posts: PostInput[];
  }>;
};

type PostReasonNormalized =
  | {
      $type: string;
      repost: string;
    }
  | {
      $type: string;
    };

type ProcessedPost = {
  uri: string;
  cid: string;
  languages: string[];
  indexedAt: string;
  feedContext?: string;
  reason: PostReasonNormalized | null;
  originalIndex: number;
};

type ValidationResult =
  | {
      success: true;
      post: ProcessedPost;
    }
  | {
      success: false;
      error: string;
    };

function resolveMaxBatchPosts(rawValue: string | undefined): number {
  if (!rawValue) {
    logger.warn('config.resolve.max.batch.posts.failed', {
      fallbackValue: DEFAULT_MAX_BATCH_POSTS,
      rawValue: null,
      reason: 'missing',
    });
    return DEFAULT_MAX_BATCH_POSTS;
  }

  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed < 1) {
    logger.warn('config.resolve.max.batch.posts.failed', {
      fallbackValue: DEFAULT_MAX_BATCH_POSTS,
      rawValue,
      reason: 'invalid',
    });
    return DEFAULT_MAX_BATCH_POSTS;
  }

  return parsed;
}

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
      'All primary language tags must be exactly two or three lowercase alphabetic characters'
    );
  }

  return deduped;
}

function validateAndProcessPost(post: PostInput, postIndex: number): ValidationResult {
  let languageCodes: string[];
  try {
    languageCodes = normalizeLanguages(post.languages);
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'All primary language tags must be exactly two or three lowercase alphabetic characters',
    };
  }

  const indexedAt = post.indexedAt
    ? new Date(post.indexedAt).toISOString()
    : new Date().toISOString();

  let reason: PostReasonNormalized | null = null;
  if (post.reason) {
    switch (post.reason.$type) {
      case 'app.bsky.feed.defs#skeletonReasonRepost':
      case 'net.nusno.gyoka.feed.batchAddPosts#skeletonReasonRepost':
        if (!post.reason.repost) {
          return {
            success: false,
            error: 'Reason type skeletonReasonRepost needs repost field',
          };
        }
        reason = {
          $type: post.reason.$type,
          repost: post.reason.repost,
        };
        break;
      case 'app.bsky.feed.defs#skeletonReasonPin':
      case 'net.nusno.gyoka.feed.batchAddPosts#skeletonReasonPin':
        reason = {
          $type: post.reason.$type,
        };
        break;
      default:
        return {
          success: false,
          error: `Unsupported reason type: ${post.reason.$type}`,
        };
    }
  }

  return {
    success: true,
    post: {
      uri: post.uri,
      cid: post.cid,
      languages: languageCodes,
      indexedAt,
      feedContext: post.feedContext,
      reason,
      originalIndex: postIndex,
    },
  };
}

export async function batchAddPosts(env: Env, input: BatchAddPostsInput): Promise<Response> {
  const db = env.DB;
  const maxBatchPostsEnv = (env as Env & { MAX_BATCH_POSTS?: string }).MAX_BATCH_POSTS;
  const { entries } = input;

  const maxBatchPosts = resolveMaxBatchPosts(maxBatchPostsEnv);
  const totalPosts = entries.reduce((sum, entry) => sum + entry.posts.length, 0);
  if (totalPosts > maxBatchPosts) {
    throw new BadRequestError(
      `Maximum ${maxBatchPosts} posts allowed per request. Received ${totalPosts} posts.`
    );
  }

  const feedMap = new Map<
    string,
    {
      posts: Array<{ post: PostInput; postIndex: number }>;
    }
  >();

  entries.forEach((entry) => {
    if (!feedMap.has(entry.feed)) {
      feedMap.set(entry.feed, { posts: [] });
    }
    const feedData = feedMap.get(entry.feed)!;
    entry.posts.forEach((post, postIndex) => {
      feedData.posts.push({ post, postIndex });
    });
  });

  const feedUris = Array.from(feedMap.keys());
  const feedInfoMap = new Map<string, number>();
  const feedErrors = new Map<string, string>();

  try {
    if (feedUris.length > 0) {
      const placeholders = feedUris.map(() => '?').join(',');
      const { success, results } = await db
        .prepare(`SELECT feed_id, feed_uri FROM feeds WHERE feed_uri IN (${placeholders})`)
        .bind(...feedUris)
        .all();

      if (!success) {
        throw new InternalServerError('Failed to query the database');
      }

      for (const result of results) {
        feedInfoMap.set(result.feed_uri as string, result.feed_id as number);
      }

      for (const feedUri of feedUris) {
        if (!feedInfoMap.has(feedUri)) {
          feedErrors.set(feedUri, `Feed with URI ${feedUri} does not exist.`);
        }
      }
    }
  } catch {
    throw new InternalServerError('Failed to query feeds');
  }

  const feedResultsMap = new Map<
    string,
    Array<{ uri: string; status: 'added' | 'error'; error?: string }>
  >();

  for (const [feedUri, feedData] of feedMap.entries()) {
    const postResults: Array<{ uri: string; status: 'added' | 'error'; error?: string }> = [];

    if (feedErrors.has(feedUri)) {
      const error = feedErrors.get(feedUri)!;
      for (const { post } of feedData.posts) {
        postResults.push({ uri: post.uri, status: 'error', error });
      }
      feedResultsMap.set(feedUri, postResults);
      continue;
    }

    const feedId = feedInfoMap.get(feedUri)!;

    const processedPosts: ProcessedPost[] = [];
    const postValidationErrors = new Map<number, string>();

    for (let i = 0; i < feedData.posts.length; i++) {
      const { post } = feedData.posts[i];
      const result = validateAndProcessPost(post, i);
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : 'unhandled error';
        postValidationErrors.set(i, errorMessage);
        continue;
      }
      processedPosts.push(result.post);
    }

    if (processedPosts.length > 0) {
      try {
        const batchStatements: D1PreparedStatement[] = [];

        for (const processedPost of processedPosts) {
          batchStatements.push(
            db
              .prepare(SQL_INSERT_POST)
              .bind(
                feedId,
                processedPost.uri,
                processedPost.cid,
                processedPost.indexedAt,
                processedPost.feedContext ?? null,
                processedPost.reason ? JSON.stringify(processedPost.reason) : null
              )
          );

          for (const lang of processedPost.languages) {
            batchStatements.push(
              db
                .prepare(SQL_INSERT_POST_LANG)
                .bind(lang, feedId, processedPost.cid, processedPost.indexedAt)
            );
          }
        }

        const batchResult = await db.batch(batchStatements);

        let statementIndex = 0;
        for (const processedPost of processedPosts) {
          const numStatements = 1 + processedPost.languages.length;
          const postStatements = batchResult.slice(statementIndex, statementIndex + numStatements);
          statementIndex += numStatements;

          if (postStatements.every((result) => result.success)) {
            postResults.push({ uri: processedPost.uri, status: 'added' });
          } else {
            postResults.push({
              uri: processedPost.uri,
              status: 'error',
              error: 'Failed to add post to DB',
            });
          }
        }
      } catch (error) {
        const isUniqueViolation =
          error instanceof Error && error.message.includes('UNIQUE constraint failed');

        for (const processedPost of processedPosts) {
          postResults.push({
            uri: processedPost.uri,
            status: 'error',
            error: isUniqueViolation
              ? `Post already exists. uri:${processedPost.uri} indexedAt:${processedPost.indexedAt}`
              : 'Failed to add post to DB',
          });
        }
      }
    }

    for (const [localIndex, error] of postValidationErrors.entries()) {
      const { post } = feedData.posts[localIndex];
      postResults.splice(feedData.posts[localIndex].postIndex, 0, {
        uri: post.uri,
        status: 'error',
        error,
      });
    }

    feedResultsMap.set(feedUri, postResults);
  }

  const results = entries.map((entry) => ({
    feed: entry.feed,
    results: feedResultsMap.get(entry.feed) || [],
  }));

  return Response.json({ results });
}
