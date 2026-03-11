import { contentJson } from 'chanfana';
import { All_LANGS } from 'shared/src/constants';
import { UnauthorizedError, BadRequestError, InternalServerError } from 'shared/src/errors';
import { createLogger } from 'shared/src/logger';
import { BaseOpenAPIRoute } from 'shared/src/routes';
import { AppContext } from 'shared/src/types';
import { feedUri, postUri, repostUri, cid } from 'shared/src/validators';
import * as z from 'zod';

const logger = createLogger({ service: 'editor', minLevel: 'debug' });
const DEFAULT_MAX_BATCH_POSTS = 25;

const PRIMARY_LANGUAGE_TAG_PATTERN = /^[a-z]{2,3}$/;

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

const SQL_INSERT_POST = `
INSERT INTO posts (feed_id, uri, cid, indexed_at, feed_context, reason) VALUES (?, ?, ?, ?, ?, ?)`;
const SQL_INSERT_POST_LANG = `
INSERT INTO post_languages (post_id, language) SELECT post_id, ? FROM posts WHERE feed_id = ? AND cid = ? AND indexed_at = ? LIMIT 1`;

const PostSchema = z
  .object({
    uri: postUri,
    cid: cid,
    languages: z.array(z.string()).nullable().optional(),
    indexedAt: z.iso.datetime({ offset: true }).optional(),
    feedContext: z.string().max(2000).optional().openapi({
      description: 'Context passed through to the client and feed generator.',
      example: 'Some feed context',
    }),
    reason: z
      .object({
        $type: z.enum([
          'app.bsky.feed.defs#skeletonReasonRepost',
          'app.bsky.feed.defs#skeletonReasonPin',
        ]),
        repost: repostUri.optional().openapi({
          description: 'Repost uri for repost type.',
        }),
      })
      .optional()
      .openapi('BatchAddPostReasonParam', {
        description:
          "Reason for including the post in the feed skeleton. Currently only 'repost' reason is supported.",
      }),
  })
  .openapi('BatchAddPostPostParam');

type PostInput = z.infer<typeof PostSchema>;

type PostReason =
  | {
      $type: 'app.bsky.feed.defs#skeletonReasonRepost';
      repost: string;
    }
  | {
      $type: 'app.bsky.feed.defs#skeletonReasonPin';
    };

interface ProcessedPost {
  uri: string;
  cid: string;
  languages: string[];
  indexedAt: string;
  feedContext?: string;
  reason: PostReason | null;
  originalIndex: number;
}

interface SuccessResult {
  success: true;
  post: ProcessedPost;
}

interface ErrorResult {
  success: false;
  error: string;
}

type ValidationResult = SuccessResult | ErrorResult;

function isErrorResult(result: ValidationResult): result is ErrorResult {
  return !result.success;
}

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

export class BatchAddPosts extends BaseOpenAPIRoute {
  schema = {
    tags: ['Feed Editor'],
    summary: 'Add multiple posts to multiple feeds',
    request: {
      body: contentJson(
        z.object({
          entries: z
            .array(
              z.object({
                feed: feedUri,
                posts: z.array(PostSchema).min(1),
              })
            )
            .openapi('BatchAddPostsEntriesParam'),
        })
      ),
    },
    responses: {
      '200': {
        description: 'Batch add posts to feeds',
        content: {
          'application/json': {
            schema: z.object({
              results: z.array(
                z.object({
                  feed: feedUri,
                  results: z.array(
                    z.object({
                      uri: postUri,
                      status: z.enum(['added', 'error']),
                      error: z.string().optional(),
                    })
                  ),
                })
              ),
            }),
          },
        },
      },
      ...UnauthorizedError.schema(),
      ...BadRequestError.schema(),
      ...InternalServerError.schema(),
    },
  };

  private validateAndProcessPost(
    post: PostInput,
    entryIndex: number,
    postIndex: number
  ): ValidationResult {
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

    // Process indexedAt
    const indexedAt = post.indexedAt
      ? new Date(post.indexedAt).toISOString()
      : new Date().toISOString();

    // Process reason object
    let reason: PostReason | null = null;
    if (post.reason) {
      switch (post.reason.$type) {
        case 'app.bsky.feed.defs#skeletonReasonRepost':
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
          reason = {
            $type: post.reason.$type,
          };
          break;
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

  async handle(c: AppContext): Promise<Response> {
    const db: D1Database = c.env.DB;
    const data = await this.getValidatedData<typeof this.schema>();
    const { entries } = data.body;

    // Use a safe default when MAX_BATCH_POSTS is missing or invalid.
    const maxBatchPosts = resolveMaxBatchPosts(c.env.MAX_BATCH_POSTS);

    // Validate max total posts limit per request
    const totalPosts = entries.reduce((sum, entry) => sum + entry.posts.length, 0);
    if (totalPosts > maxBatchPosts) {
      throw new BadRequestError(
        `Maximum ${maxBatchPosts} posts allowed per request. Received ${totalPosts} posts.`
      );
    }

    // Group entries by feed to reduce database queries
    const feedMap = new Map<
      string,
      {
        entryIndices: number[];
        posts: Array<{ post: PostInput; entryIndex: number; postIndex: number }>;
      }
    >();

    entries.forEach((entry, entryIndex) => {
      const feed_uri = entry.feed;
      if (!feedMap.has(feed_uri)) {
        feedMap.set(feed_uri, { entryIndices: [], posts: [] });
      }
      const feedData = feedMap.get(feed_uri)!;
      feedData.entryIndices.push(entryIndex);
      entry.posts.forEach((post, postIndex) => {
        feedData.posts.push({ post, entryIndex, postIndex });
      });
    });

    // Query all unique feeds at once
    const feedUris = Array.from(feedMap.keys());
    const feedInfoMap = new Map<string, number>(); // feed_uri -> feed_id
    const feedErrors = new Map<string, string>(); // feed_uri -> error message

    try {
      // Query all feeds at once using IN clause
      if (feedUris.length === 0) {
        // No feeds to query
      } else {
        const placeholders = feedUris.map(() => '?').join(',');
        const { success, results } = await db
          .prepare(`SELECT feed_id, feed_uri FROM feeds WHERE feed_uri IN (${placeholders})`)
          .bind(...feedUris)
          .all();

        if (!success) {
          logger.error('db.query.feeds.failed', {
            feedCount: feedUris.length,
          });
          throw new InternalServerError('Failed to query the database');
        }

        // Map results to feedInfoMap
        for (const result of results) {
          feedInfoMap.set(result.feed_uri as string, result.feed_id as number);
        }

        // Identify feeds that don't exist
        for (const feed_uri of feedUris) {
          if (!feedInfoMap.has(feed_uri)) {
            feedErrors.set(feed_uri, `Feed with URI ${feed_uri} does not exist.`);
          }
        }
      }
    } catch (error) {
      logger.error('db.query.feeds.failed', {
        error,
      });
      throw new InternalServerError('Failed to query feeds');
    }

    // Process posts grouped by feed
    const feedResultsMap = new Map<
      string,
      Array<{ uri: string; status: 'added' | 'error'; error?: string }>
    >();

    for (const [feed_uri, feedData] of feedMap.entries()) {
      const postResults: Array<{ uri: string; status: 'added' | 'error'; error?: string }> = [];

      // If feed has error, mark all posts as error
      if (feedErrors.has(feed_uri)) {
        const error = feedErrors.get(feed_uri)!;
        for (const { post } of feedData.posts) {
          postResults.push({
            uri: post.uri,
            status: 'error',
            error,
          });
        }
        feedResultsMap.set(feed_uri, postResults);
        continue;
      }

      const feed_id = feedInfoMap.get(feed_uri)!;

      // Validate and process all posts
      const processedPosts: ProcessedPost[] = [];
      const postValidationErrors = new Map<number, string>();

      for (let i = 0; i < feedData.posts.length; i++) {
        const { post } = feedData.posts[i];
        const result = this.validateAndProcessPost(post, feedData.posts[i].entryIndex, i);

        if (isErrorResult(result)) {
          postValidationErrors.set(i, result.error || 'unhandled error');
        } else {
          processedPosts.push(result.post);
        }
      }

      // Batch insert all valid posts for this feed
      if (processedPosts.length > 0) {
        try {
          const batchStatements = [];

          for (const processedPost of processedPosts) {
            // Add post statement
            const addPostStmt = db
              .prepare(SQL_INSERT_POST)
              .bind(
                feed_id,
                processedPost.uri,
                processedPost.cid,
                processedPost.indexedAt,
                processedPost.feedContext ?? null,
                processedPost.reason ? JSON.stringify(processedPost.reason) : null
              );
            batchStatements.push(addPostStmt);

            // Add language statements
            for (const lang of processedPost.languages) {
              batchStatements.push(
                db
                  .prepare(SQL_INSERT_POST_LANG)
                  .bind(lang, feed_id, processedPost.cid, processedPost.indexedAt)
              );
            }
          }

          const batchResult = await db.batch(batchStatements);

          // Check results - each post has 1 + N statements (1 for post, N for languages)
          let statementIndex = 0;
          for (const processedPost of processedPosts) {
            const numStatements = 1 + processedPost.languages.length;
            const postStatements = batchResult.slice(
              statementIndex,
              statementIndex + numStatements
            );
            statementIndex += numStatements;

            if (postStatements.every((result) => result.success)) {
              postResults.push({
                uri: processedPost.uri,
                status: 'added',
              });
            } else {
              postResults.push({
                uri: processedPost.uri,
                status: 'error',
                error: 'Failed to add post to DB',
              });
            }
          }
        } catch (error) {
          // Handle batch insert errors (log raw message, sanitize response)
          logger.error('db.batch_insert.posts.failed', {
            feed_uri,
            error,
          });

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

      // Add validation errors for invalid posts
      for (const [localIndex, error] of postValidationErrors.entries()) {
        const { post } = feedData.posts[localIndex];
        // Find the position where this should be inserted
        const insertIndex = feedData.posts[localIndex].postIndex;
        postResults.splice(insertIndex, 0, {
          uri: post.uri,
          status: 'error',
          error,
        });
      }

      feedResultsMap.set(feed_uri, postResults);
    }

    // Build response in original entry order
    const results = entries.map((entry) => ({
      feed: entry.feed,
      results: feedResultsMap.get(entry.feed) || [],
    }));

    return Response.json({ results });
  }
}
