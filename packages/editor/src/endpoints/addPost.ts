import { OpenAPIRoute, ApiException, contentJson } from 'chanfana';
import { z } from 'zod';
import {
  BadRequestErrorSchema,
  InternalServerErrorSchema,
  UnknownFeedErrorSchema,
  UnauthorizedErrorSchema,
  All_LANGS,
} from 'shared/src/constants';
import { feedUri, postUri, repostUri, cid } from 'shared/src/validators';
import { AppContext, createErrorResponse } from 'shared/src/types';

const SQL_SELECT_FEED = 'SELECT * FROM feeds WHERE feed_uri = ?';
const SQL_INSERT_POST = `
INSERT INTO posts (feed_id, did, uri, cid, indexed_at, feed_context, reason) VALUES (?, ?, ?, ?, ?, ?, ?)`;
const SQL_INSERT_POST_LANG = `
INSERT INTO post_languages (post_id, language) SELECT post_id, ? FROM posts WHERE feed_id = ? AND cid = ? AND indexed_at = ? LIMIT 1`;

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
              indexedAt: z.string().datetime({ offset: true }).optional(),
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
                indexedAt: z.string().datetime(),
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
      ...UnauthorizedErrorSchema,
      ...UnknownFeedErrorSchema,
      ...BadRequestErrorSchema,
      ...InternalServerErrorSchema,
    },
  };

  handleValidationError(errors: z.ZodIssue[]): Response {
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
    if (languageCodes.length === 0) {
      //error if no valid code in request field.
      return createErrorResponse('BadRequest', 'At least one valid language code is required', 400);
    }
    if (languageCodes.some((code) => !(code === '*' || /^[a-z]{2,3}$/.test(code)))) {
      return createErrorResponse(
        'BadRequest',
        'All primary language tags must be exactly two or three lowercase alphabetic characters (e.g., "en", "jp").',
        400
      );
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
            return createErrorResponse(
              'BadRequest',
              'Reason type app.bsky.feed.defs#skeletonReasonRepost needs repost field',
              400
            );
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
      // Check if the feed exists
      const { success: selectSuccess, results } = await db
        .prepare(SQL_SELECT_FEED)
        .bind(feed_uri)
        .all();
      if (!selectSuccess) {
        throw new ApiException('Failed to query the database');
      }
      if (results.length === 0) {
        return createErrorResponse('UnknownFeed', `Feed with URI ${feed_uri} does not exist.`, 404);
      }
      const feed_id = results[0].feed_id;
      // extract DID from post.uri for search performance
      const did = post.uri.split('/')[2];
      // add post and post_langs to DB by batch
      const addPostStmt = db
        .prepare(SQL_INSERT_POST)
        .bind(
          feed_id,
          did,
          post.uri,
          post.cid,
          post.indexedAt,
          post.feedContext ?? null,
          post.reason ? JSON.stringify(reason) : null
        );
      const addPostLangStmt = [];
      for (const lang of post.languages) {
        addPostLangStmt.push(
          db.prepare(SQL_INSERT_POST_LANG).bind(lang, feed_id, post.cid, post.indexedAt)
        );
      }

      const batchResult = await db.batch([addPostStmt, ...addPostLangStmt]);

      if (!batchResult.every((result) => result.success)) {
        throw new ApiException('Failed to add post to DB');
      }
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        return createErrorResponse(
          'BadRequest',
          `post already exists. uri:${post.uri} indexedAt:${post.indexedAt}`,
          400
        );
      }
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
