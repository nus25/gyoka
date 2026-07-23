import { BadRequestError, InternalServerError } from 'shared/src/errors/core';
import { createLogger } from 'shared/src/logger';

const SQL_DELETE_POST = `
DELETE FROM posts 
WHERE feed_id = ?
  AND uri = ? 
  AND (? IS NULL OR indexed_at = ?)`;
const SQL_CHECK_POSTS = 'SELECT uri, indexed_at FROM posts WHERE feed_id = ? AND uri IN ';

const logger = createLogger({ service: 'editor', minLevel: 'debug' });
const DEFAULT_MAX_BATCH_POSTS = 25;

type BatchRemovePostsInput = {
  entries: Array<{
    feed: string;
    posts: Array<{
      uri: string;
      indexedAt?: string;
    }>;
  }>;
};

type PostToRemove = {
  uri: string;
  indexedAt: string | null;
  entryIndex: number;
  postIndex: number;
};

type EntryResult = {
  postIndex: number;
  uri: string;
  status: 'removed' | 'error';
  error?: string;
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

export async function batchRemovePosts(env: Env, input: BatchRemovePostsInput): Promise<Response> {
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
      entryIndices: number[];
      posts: Array<{
        post: { uri: string; indexedAt?: string };
        entryIndex: number;
        postIndex: number;
      }>;
    }
  >();

  entries.forEach((entry, entryIndex) => {
    if (!feedMap.has(entry.feed)) {
      feedMap.set(entry.feed, { entryIndices: [], posts: [] });
    }
    const feedData = feedMap.get(entry.feed)!;
    feedData.entryIndices.push(entryIndex);
    entry.posts.forEach((post, postIndex) => {
      feedData.posts.push({ post, entryIndex, postIndex });
    });
  });

  const feedUris = Array.from(feedMap.keys());
  const feedInfoMap = new Map<string, number>();
  const feedErrors = new Map<string, string>();

  try {
    if (feedUris.length > 0) {
      const placeholders = feedUris.map(() => '?').join(',');
      const feedQuery = `SELECT feed_id, feed_uri FROM feeds WHERE feed_uri IN (${placeholders})`;
      const { success, results } = await db
        .prepare(feedQuery)
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

  const entryResultsMap = new Map<number, EntryResult[]>();

  const recordEntryResult = (entryIndex: number, result: EntryResult) => {
    if (!entryResultsMap.has(entryIndex)) {
      entryResultsMap.set(entryIndex, []);
    }
    entryResultsMap.get(entryIndex)!.push(result);
  };

  for (const [feedUri, feedData] of feedMap.entries()) {
    if (feedErrors.has(feedUri)) {
      const error = feedErrors.get(feedUri)!;
      for (const { post, entryIndex, postIndex } of feedData.posts) {
        recordEntryResult(entryIndex, {
          postIndex,
          uri: post.uri,
          status: 'error',
          error,
        });
      }
      continue;
    }

    const feedId = feedInfoMap.get(feedUri)!;
    const postsToRemove: PostToRemove[] = feedData.posts.map(({ post, postIndex, entryIndex }) => ({
      uri: post.uri,
      indexedAt: post.indexedAt ? new Date(post.indexedAt).toISOString() : null,
      entryIndex,
      postIndex,
    }));

    const existingPostsMap = new Map<string, Set<string>>();

    try {
      const uris = postsToRemove.map((p) => p.uri);
      const uniqueUris = Array.from(new Set(uris));
      if (uniqueUris.length > 0) {
        const placeholders = uniqueUris.map(() => '?').join(',');
        const checkQuery = `${SQL_CHECK_POSTS}(${placeholders})`;
        const { success, results } = await db
          .prepare(checkQuery)
          .bind(feedId, ...uniqueUris)
          .all();
        if (!success) {
          throw new InternalServerError('Failed to check existing posts');
        }

        for (const result of results) {
          const uri = result.uri as string;
          const indexedAt = result.indexed_at as string;
          if (!existingPostsMap.has(uri)) {
            existingPostsMap.set(uri, new Set());
          }
          existingPostsMap.get(uri)!.add(indexedAt);
        }
      }
    } catch {
      for (const postToRemove of postsToRemove) {
        recordEntryResult(postToRemove.entryIndex, {
          postIndex: postToRemove.postIndex,
          uri: postToRemove.uri,
          status: 'error',
          error: 'Failed to check post existence',
        });
      }
      continue;
    }

    const validPosts: PostToRemove[] = [];
    const notFoundResults: Array<{ uri: string; entryIndex: number; postIndex: number }> = [];

    for (const postToRemove of postsToRemove) {
      const existingIndexedAts = existingPostsMap.get(postToRemove.uri);
      if (!existingIndexedAts || existingIndexedAts.size === 0) {
        notFoundResults.push({
          uri: postToRemove.uri,
          entryIndex: postToRemove.entryIndex,
          postIndex: postToRemove.postIndex,
        });
      } else if (postToRemove.indexedAt === null) {
        validPosts.push(postToRemove);
      } else if (existingIndexedAts.has(postToRemove.indexedAt)) {
        validPosts.push(postToRemove);
      } else {
        notFoundResults.push({
          uri: postToRemove.uri,
          entryIndex: postToRemove.entryIndex,
          postIndex: postToRemove.postIndex,
        });
      }
    }

    if (validPosts.length > 0) {
      try {
        const batchStatements = validPosts.map((postToRemove) =>
          db
            .prepare(SQL_DELETE_POST)
            .bind(feedId, postToRemove.uri, postToRemove.indexedAt, postToRemove.indexedAt)
        );

        const batchResult = await db.batch(batchStatements);
        for (let i = 0; i < validPosts.length; i++) {
          const postToRemove = validPosts[i];
          const result = batchResult[i];
          if (result.success) {
            recordEntryResult(postToRemove.entryIndex, {
              postIndex: postToRemove.postIndex,
              uri: postToRemove.uri,
              status: 'removed',
            });
          } else {
            recordEntryResult(postToRemove.entryIndex, {
              postIndex: postToRemove.postIndex,
              uri: postToRemove.uri,
              status: 'error',
              error: 'Failed to remove post from DB',
            });
          }
        }
      } catch {
        for (const postToRemove of validPosts) {
          recordEntryResult(postToRemove.entryIndex, {
            postIndex: postToRemove.postIndex,
            uri: postToRemove.uri,
            status: 'error',
            error: 'Failed to remove post from DB',
          });
        }
      }
    }

    for (const notFound of notFoundResults) {
      recordEntryResult(notFound.entryIndex, {
        postIndex: notFound.postIndex,
        uri: notFound.uri,
        status: 'error',
        error: 'Post not found in feed',
      });
    }
  }

  const results = entries.map((entry, entryIndex) => {
    const entryResults = entryResultsMap.get(entryIndex) || [];
    entryResults.sort((a, b) => a.postIndex - b.postIndex);
    return {
      feed: entry.feed,
      results: entryResults.map(({ postIndex: _postIndex, ...rest }) => rest),
    };
  });

  return Response.json({ results });
}
