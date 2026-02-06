import { OpenAPIRoute, contentJson } from 'chanfana';
import * as z from 'zod';
import { All_LANGS } from 'shared/src/constants';
import { feedUri, postUri, repostUri, cid } from 'shared/src/validators';
import { AppContext } from 'shared/src/types';
import {
  UnauthorizedError,
  UnknownFeedError,
  BadRequestError,
  InternalServerError,
  createErrorResponse,
} from 'shared/src/errors';

const SQL_INSERT_POST = `
INSERT INTO posts (feed_id, did, uri, cid, indexed_at, feed_context, reason)
SELECT feed_id, ?, ?, ?, ?, ?, ?
FROM feeds
WHERE feed_uri = ?
RETURNING post_id`;
const SQL_INSERT_POST_LANG = `
INSERT INTO post_languages (post_id, language) VALUES (?, ?)`;

export class AddPost extends OpenAPIRoute {
  schema = {
    tags: ['Feed Editor'],
    summary: 'Add new post to feed',
    request: {
      body: contentJson(
        z.object({
          feed: feedUri,
          post: z
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
                .openapi('AddPostReasonParam', {
                  description:
                    "Reason for including the post in the feed skeleton. Currently only 'repost' reason is supported.",
                }),
            })
            .openapi('AddPostPostParam'),
        })
      ),
    },
    responses: {
      '200': {
        description: 'Add post to feed',
        content: {
          'application/json': {
            schema: z.object({
              message: z.string(),
              feed: feedUri,
              post: z.object({
                uri: postUri,
                cid: cid,
                languages: z.array(z.string()),
                indexedAt: z.iso.datetime(),
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
                  .openapi({
                    description:
                      "Reason for including the post in the feed skeleton. Currently only 'repost' reason is supported.",
                  }),
              }),
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
    const { feed: feed_uri, post } = data.body;
    if (!post.languages) {
      // set languages to '*' if not provided
      post.languages = [All_LANGS];
    }
    const languageCodes = [
      ...new Set(
        post.languages
          .map((lang) => lang.split('-')[0]) // Extract language code (e.g., "en" from "en-US")
          .map((lang) => lang.toLowerCase())
          .filter((lang) => lang)
      ),
    ];

    if (languageCodes.some((code) => !(code === '*' || /^[a-z]{2,3}$/.test(code)))) {
      throw new BadRequestError('All primary language tags must be exactly two or three lowercase alphabetic characters (e.g., "en", "jp").');
    }

    post.languages = languageCodes;

    if (!post.indexedAt) {
      // set indexedAt to current date as default.
      post.indexedAt = new Date().toISOString();
    } else {
      post.indexedAt = new Date(post.indexedAt).toISOString();
    }

    // make reason object
    let reason = null;
    if (post.reason) {
      switch (post.reason.$type) {
        case 'app.bsky.feed.defs#skeletonReasonRepost':
          if (!post.reason.repost) {
            throw new BadRequestError('Reason type app.bsky.feed.defs#skeletonReasonRepost needs repost field');
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

    try {
      // extract DID from post.uri for search performance
      const did = post.uri.split('/')[2];
      // Insert post with feed existence check in single query using RETURNING
      const { success: insertSuccess, results } = await db
        .prepare(SQL_INSERT_POST)
        .bind(
          did,
          post.uri,
          post.cid,
          post.indexedAt,
          post.feedContext ?? null,
          post.reason ? JSON.stringify(reason) : null,
          feed_uri
        )
        .all();
      if (!insertSuccess) {
        throw new InternalServerError('Failed to insert post to the database');
      }
      // If no rows returned, feed doesn't exist
      if (results.length === 0) {
        throw new UnknownFeedError(`Feed with URI ${feed_uri} does not exist.`);
      }
      const post_id = results[0].post_id;
      // add post_langs to DB by batch using returned post_id
      const addPostLangStmt = post.languages.map((lang) =>
        db.prepare(SQL_INSERT_POST_LANG).bind(post_id, lang)
      );

      const batchResult = await db.batch(addPostLangStmt);

      if (!batchResult.every((result) => result.success)) {
        throw new InternalServerError('Failed to add post languages to DB');
      }
    } catch (error) {
      console.error('Failed to add post to feed:', error);
      throw error;
    }
    const response = {
      message: 'Post added successfully',
      feed: feed_uri,
      post: {
        uri: post.uri,
        cid: post.cid,
        languages: post.languages[0] !== All_LANGS ? post.languages : undefined,
        indexedAt: post.indexedAt,
        feedContext: post.feedContext,
        reason: reason ?? undefined,
      },
    };
    return Response.json(response);
  }
}
