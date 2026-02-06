import { OpenAPIRoute, contentJson } from 'chanfana';
import * as z from 'zod';
import { feedUri, postUri } from 'shared/src/validators';
import { AppContext } from 'shared/src/types';
import {
  UnauthorizedError,
  UnknownFeedError,
  BadRequestError,
  InternalServerError,
  createErrorResponse,
} from 'shared/src/errors';

const SQL_DELETE_POST = `
DELETE FROM posts 
WHERE feed_id = ?
  AND uri = ? 
  AND (? IS NULL OR indexed_at = ?)`;

const SQL_CHECK_POSTS = `
SELECT uri, indexed_at FROM posts WHERE feed_id = ? AND uri IN `;

const RemovePostSchema = z
  .object({
    uri: postUri,
    indexedAt: z.iso.datetime({ offset: true }).optional(),
  })
  .openapi('BatchRemovePostPostParam');

interface PostToRemove {
  uri: string;
  indexedAt: string | null;
  entryIndex: number;
  postIndex: number;
}

type EntryResult = {
  postIndex: number;
  uri: string;
  status: 'removed' | 'error';
  error?: string;
};

export class BatchRemovePosts extends OpenAPIRoute {
  schema = {
    tags: ['Feed Editor'],
    summary: 'Remove multiple posts from multiple feeds',
    request: {
      body: contentJson(
        z.object({
          entries: z
            .array(
              z.object({
                feed: feedUri,
                posts: z.array(RemovePostSchema).min(1),
              })
            )
            .openapi('BatchRemovePostsEntriesParam'),
        })
      ),
    },
    responses: {
      '200': {
        description: 'Batch remove posts from feeds',
        content: {
          'application/json': {
            schema: z.object({
              results: z.array(
                z.object({
                  feed: feedUri,
                  results: z.array(
                    z.object({
                      uri: postUri,
                      status: z.enum(['removed', 'error']),
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
      ...UnknownFeedError.schema(),
      ...BadRequestError.schema(),
      ...InternalServerError.schema(),
    },
  };

  handleValidationError(errors: z.core.$ZodIssue[]): Response {
    return createErrorResponse(
      'BadRequest',
      JSON.stringify(
        errors.map((error) => ({
          message: error.message,
          path: error.path,
        }))
      ),
      400
    );
  }

  async handle(c: AppContext): Promise<Response> {
    const db: D1Database = c.env.DB;
    const data = await this.getValidatedData<typeof this.schema>();
    const { entries } = data.body;

    // Get max batch posts from environment variable or default to 25
    const maxBatchPosts = parseInt(c.env.MAX_BATCH_POSTS || '25', 10);

    // Validate max total posts limit per request
    const totalPosts = entries.reduce((sum, entry) => sum + entry.posts.length, 0);
    if (totalPosts > maxBatchPosts) {
      throw new BadRequestError(
        `Maximum ${maxBatchPosts} posts allowed per request. Received ${totalPosts} posts.`
      );
    }

    if (c.env.DEVELOPER_MODE === 'enabled') {
      console.log('Batch removing posts:', {
        totalPosts,
        uniqueFeeds: new Set(entries.map((e) => e.feed)).size,
      });
    }

    // Group entries by feed to reduce database queries
    const feedMap = new Map<
      string,
      {
        entryIndices: number[];
        posts: Array<{ post: any; entryIndex: number; postIndex: number }>;
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
        const feedQuery = `SELECT feed_id, feed_uri FROM feeds WHERE feed_uri IN (${placeholders})`;

        if (c.env.DEVELOPER_MODE === 'enabled') {
          console.log('Generated query:', feedQuery);
          console.log('Bindings:', feedUris);
        }

        const { success, results } = await db
          .prepare(feedQuery)
          .bind(...feedUris)
          .all();

        if (!success) {
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
      console.error('Error querying feeds:', error);
      throw new InternalServerError('Failed to query feeds');
    }

    const entryResultsMap = new Map<number, EntryResult[]>();

    const recordEntryResult = (entryIndex: number, result: EntryResult) => {
      if (!entryResultsMap.has(entryIndex)) {
        entryResultsMap.set(entryIndex, []);
      }
      entryResultsMap.get(entryIndex)!.push(result);
    };

    for (const [feed_uri, feedData] of feedMap.entries()) {
      // If feed has error, mark all posts as error
      if (feedErrors.has(feed_uri)) {
        const error = feedErrors.get(feed_uri)!;
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

      const feed_id = feedInfoMap.get(feed_uri)!;

      // Prepare posts to remove with normalized indexedAt
      const postsToRemove: PostToRemove[] = feedData.posts.map(
        ({ post, postIndex, entryIndex }) => ({
          uri: post.uri,
          indexedAt: post.indexedAt ? new Date(post.indexedAt).toISOString() : null,
          entryIndex,
          postIndex,
        })
      );

      // Check which posts exist before attempting deletion
      const existingPostsMap = new Map<string, Set<string>>(); // uri -> Set of indexed_at values
      try {
        const uris = postsToRemove.map((p) => p.uri);
        const uniqueUris = Array.from(new Set(uris));

        if (uniqueUris.length > 0) {
          const placeholders = uniqueUris.map(() => '?').join(',');
          const checkQuery = `${SQL_CHECK_POSTS}(${placeholders})`;
          const checkBindings: (string | number)[] = [feed_id, ...uniqueUris];

          if (c.env.DEVELOPER_MODE === 'enabled') {
            console.log('Generated query:', checkQuery);
            console.log('Bindings:', checkBindings);
          }

          const { success, results } = await db
            .prepare(checkQuery)
            .bind(...checkBindings)
            .all();

          if (!success) {
            throw new InternalServerError('Failed to check existing posts');
          }

          // Build map of existing posts
          for (const result of results) {
            const uri = result.uri as string;
            const indexedAt = result.indexed_at as string;
            if (!existingPostsMap.has(uri)) {
              existingPostsMap.set(uri, new Set());
            }
            existingPostsMap.get(uri)!.add(indexedAt);
          }
        }
      } catch (error) {
        console.error(`Error checking posts for feed ${feed_uri}:`, error);
        // Mark all posts as error
        for (const postToRemove of postsToRemove) {
          const message = error instanceof Error ? error.message : 'Failed to check post existence';
          recordEntryResult(postToRemove.entryIndex, {
            postIndex: postToRemove.postIndex,
            uri: postToRemove.uri,
            status: 'error',
            error: message,
          });
        }
        continue;
      }

      // Separate posts into valid (existing) and not found
      const validPosts: PostToRemove[] = [];
      const notFoundResults: Array<{ uri: string; entryIndex: number; postIndex: number }> = [];

      for (const postToRemove of postsToRemove) {
        const existingIndexedAts = existingPostsMap.get(postToRemove.uri);

        if (!existingIndexedAts || existingIndexedAts.size === 0) {
          // Post URI doesn't exist at all
          notFoundResults.push({
            uri: postToRemove.uri,
            entryIndex: postToRemove.entryIndex,
            postIndex: postToRemove.postIndex,
          });
        } else if (postToRemove.indexedAt === null) {
          // No indexedAt specified, so any post with this URI is valid
          validPosts.push(postToRemove);
        } else if (existingIndexedAts.has(postToRemove.indexedAt)) {
          // Exact match found
          validPosts.push(postToRemove);
        } else {
          // URI exists but not with this indexedAt
          notFoundResults.push({
            uri: postToRemove.uri,
            entryIndex: postToRemove.entryIndex,
            postIndex: postToRemove.postIndex,
          });
        }
      }

      // Batch delete valid posts
      if (validPosts.length > 0) {
        try {
          const deleteBindingsForLog: Array<Array<number | string | null>> = [];
          const batchStatements = validPosts.map((postToRemove) => {
            const bindings: [number, string, string | null, string | null] = [
              feed_id,
              postToRemove.uri,
              postToRemove.indexedAt,
              postToRemove.indexedAt,
            ];

            if (c.env.DEVELOPER_MODE === 'enabled') {
              deleteBindingsForLog.push(bindings);
            }

            return db.prepare(SQL_DELETE_POST).bind(...bindings);
          });

          if (c.env.DEVELOPER_MODE === 'enabled') {
            console.log('Generated query:', SQL_DELETE_POST.trim());
            console.log('Bindings:', deleteBindingsForLog);
          }

          const batchResult = await db.batch(batchStatements);

          // Check each deletion result
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
        } catch (error) {
          console.error(`Error batch deleting posts for feed ${feed_uri}:`, error);

          // Mark all valid posts as error
          for (const postToRemove of validPosts) {
            const message = error instanceof Error ? error.message : 'An unexpected error occurred';
            recordEntryResult(postToRemove.entryIndex, {
              postIndex: postToRemove.postIndex,
              uri: postToRemove.uri,
              status: 'error',
              error: message,
            });
          }
        }
      }

      // Add not found errors
      for (const notFound of notFoundResults) {
        recordEntryResult(notFound.entryIndex, {
          postIndex: notFound.postIndex,
          uri: notFound.uri,
          status: 'error',
          error: 'Post not found in feed',
        });
      }

      if (c.env.DEVELOPER_MODE === 'enabled') {
        let deletedCount = 0;
        let errorCount = 0;
        for (const entryIndex of feedData.entryIndices) {
          const entryResults = entryResultsMap.get(entryIndex) ?? [];
          for (const result of entryResults) {
            if (result.status === 'removed') {
              deletedCount++;
            } else {
              errorCount++;
            }
          }
        }
        console.log('Feed deletion result:', {
          feed_uri,
          deleted: deletedCount,
          errors: errorCount,
        });
      }
    }

    // Build response in original entry order
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
}
