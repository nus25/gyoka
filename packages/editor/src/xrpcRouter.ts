import { XRPCRouter } from '@atcute/xrpc-server';
import { Logger } from 'shared/src/logger';

import { createRequireAuth } from './auth/createRequireAuth';
import { getDocument } from './endpoints/getDocument';
import { listFeeds } from './endpoints/listFeeds';
import { listPosts } from './endpoints/listPosts';
import { movePosts } from './endpoints/movePosts';
import { ping } from './endpoints/ping';
import { prunePostsBefore } from './endpoints/prunePostsBefore';
import { putPosts } from './endpoints/putPosts';
import { rebalanceOrder } from './endpoints/rebalanceOrder';
import { registerFeed } from './endpoints/registerFeed';
import { removePosts } from './endpoints/removePosts';
import { removePostsByAuthor } from './endpoints/removePostsByAuthor';
import { trimPosts } from './endpoints/trimPosts';
import { unregisterFeed } from './endpoints/unregisterFeed';
import { updateDocument } from './endpoints/updateDocument';
import { updateFeed } from './endpoints/updateFeed';
import { handleAppError } from './errorHandler';
import {
  NetNusnoGyokaDocumentGetDocument,
  NetNusnoGyokaDocumentUpdateDocument,
  NetNusnoGyokaFeedListPosts,
  NetNusnoGyokaFeedListFeeds,
  NetNusnoGyokaFeedMovePosts,
  NetNusnoGyokaFeedPrunePostsBefore,
  NetNusnoGyokaFeedPutPosts,
  NetNusnoGyokaFeedRebalanceOrder,
  NetNusnoGyokaFeedRemovePosts,
  NetNusnoGyokaFeedRemovePostsByAuthor,
  NetNusnoGyokaFeedTrimPosts,
  NetNusnoGyokaFeedRegisterFeed,
  NetNusnoGyokaFeedUnregisterFeed,
  NetNusnoGyokaFeedUpdateFeed,
  NetNusnoGyokaPing,
} from './lexicons';

export type XrpcRuntimeConfig = {
  isDevMode: boolean;
  requiredAuth: boolean;
  host: string;
  adminDids: string[];
  ttlSeconds: number;
};

type InvalidRequestPayload = {
  error?: string;
  message?: string;
  'net.kelinci.atcute.issues'?: unknown;
};

export async function sanitizeAtcuteValidationResponse(
  response: Response,
  logger: Logger
): Promise<Response> {
  if (response.status !== 400) {
    return response;
  }

  const contentType = response.headers.get('Content-Type');
  if (!contentType || !contentType.toLowerCase().includes('application/json')) {
    return response;
  }

  let payload: InvalidRequestPayload;
  try {
    payload = (await response.clone().json()) as InvalidRequestPayload;
  } catch {
    return response;
  }

  if (!payload || payload.error !== 'InvalidRequest') {
    return response;
  }

  const issues = payload['net.kelinci.atcute.issues'];
  if (issues === undefined) {
    return response;
  }

  logger.warn('api.validate.request.failed', {
    status: response.status,
    errorCode: 'BadRequest',
    issueCount: Array.isArray(issues) ? issues.length : undefined,
  });

  const headers = new Headers(response.headers);
  headers.delete('content-length');

  return new Response(
    JSON.stringify({
      error: 'BadRequest',
      message: payload.message,
    }),
    {
      status: response.status,
      headers,
    }
  );
}

export function createXrpcRouter(
  config: XrpcRuntimeConfig,
  envMap: WeakMap<Request, Env>,
  logger: Logger
): XRPCRouter {
  const requireAuth = createRequireAuth(
    config.requiredAuth,
    config.host,
    config.adminDids,
    config.ttlSeconds,
    logger
  );

  const router = new XRPCRouter({
    handleException: (error) => handleAppError(error, config.isDevMode, logger),
  });

  router.addQuery(NetNusnoGyokaPing.mainSchema, {
    async handler({ request }) {
      const context = { operation: 'ping', stage: 'auth' };
      try {
        await requireAuth(request, 'net.nusno.gyoka.ping');
        const response = ping();
        logger.debug('api.ping.service.success', context);
        return response;
      } catch (error) {
        return handleAppError(error, config.isDevMode, logger, context);
      }
    },
  });

  router.addQuery(NetNusnoGyokaFeedListFeeds.mainSchema, {
    async handler({ request }) {
      const context: Record<string, unknown> = { operation: 'listFeeds', stage: 'auth' };
      try {
        await requireAuth(request, 'net.nusno.gyoka.feed.listFeeds');
        const response = await listFeeds(envMap.get(request)!.DB, context);
        logger.debug('feed.list.feeds.success', context);
        return response;
      } catch (error) {
        return handleAppError(error, config.isDevMode, logger, context);
      }
    },
  });

  router.addQuery(NetNusnoGyokaDocumentGetDocument.mainSchema, {
    async handler({ request, params }) {
      const context: Record<string, unknown> = {
        operation: 'getDocument',
        stage: 'auth',
        docType: params.docType,
      };
      try {
        await requireAuth(request, 'net.nusno.gyoka.document.getDocument');
        const response = await getDocument(
          envMap.get(request)!.DB,
          {
            docType: params.docType,
          },
          context
        );
        logger.debug('document.get.document.success', context);
        return response;
      } catch (error) {
        return handleAppError(error, config.isDevMode, logger, context);
      }
    },
  });

  router.addProcedure(NetNusnoGyokaFeedRegisterFeed.mainSchema, {
    async handler({ request, input }) {
      const context: Record<string, unknown> = {
        operation: 'registerFeed',
        stage: 'auth',
        langFilter: input.langFilter ?? true,
        isActive: input.isActive ?? true,
      };
      try {
        await requireAuth(request, 'net.nusno.gyoka.feed.registerFeed');
        context.stage = 'write';
        const response = await registerFeed(envMap.get(request)!.DB, {
          uri: input.uri,
          langFilter: input.langFilter,
          isActive: input.isActive,
        });
        context.feed = input.uri;
        logger.debug('feed.register.feed.success', context);
        return response;
      } catch (error) {
        return handleAppError(error, config.isDevMode, logger, context);
      }
    },
  });

  router.addProcedure(NetNusnoGyokaFeedUpdateFeed.mainSchema, {
    async handler({ request, input }) {
      const context: Record<string, unknown> = {
        operation: 'updateFeed',
        stage: 'auth',
        langFilter: input.langFilter,
        isActive: input.isActive,
      };
      try {
        await requireAuth(request, 'net.nusno.gyoka.feed.updateFeed');
        const response = await updateFeed(
          envMap.get(request)!.DB,
          {
            uri: input.uri,
            langFilter: input.langFilter,
            isActive: input.isActive,
          },
          context
        );
        logger.debug('feed.update.feed.success', context);
        return response;
      } catch (error) {
        return handleAppError(error, config.isDevMode, logger, context);
      }
    },
  });

  router.addProcedure(NetNusnoGyokaFeedUnregisterFeed.mainSchema, {
    async handler({ request, input }) {
      const context: Record<string, unknown> = { operation: 'unregisterFeed', stage: 'auth' };
      try {
        await requireAuth(request, 'net.nusno.gyoka.feed.unregisterFeed');
        const response = await unregisterFeed(envMap.get(request)!.DB, { uri: input.uri }, context);
        logger.debug('feed.unregister.feed.success', context);
        return response;
      } catch (error) {
        return handleAppError(error, config.isDevMode, logger, context);
      }
    },
  });

  router.addQuery(NetNusnoGyokaFeedListPosts.mainSchema, {
    async handler({ request, params }) {
      const context: Record<string, unknown> = {
        operation: 'listPosts',
        stage: 'auth',
        limit: params.limit ?? 1000,
        hasCursor: !!params.cursor,
        hasAuthor: !!params.author,
        hasUri: !!params.uri,
      };
      try {
        await requireAuth(request, 'net.nusno.gyoka.feed.listPosts');
        const response = await listPosts(
          envMap.get(request)!.DB,
          {
            feed: params.feed,
            uri: params.uri,
            author: params.author,
            limit: params.limit,
            cursor: params.cursor,
          },
          context
        );
        logger.debug('feed.list.posts.success', context);
        return response;
      } catch (error) {
        return handleAppError(error, config.isDevMode, logger, context);
      }
    },
  });

  router.addProcedure(NetNusnoGyokaFeedPutPosts.mainSchema, {
    async handler({ request, input }) {
      const context: Record<string, unknown> = { operation: 'putPosts', stage: 'auth' };
      try {
        await requireAuth(request, 'net.nusno.gyoka.feed.putPosts');
        const env = envMap.get(request)!;
        return await putPosts(env.DB, input, context, logger);
      } catch (error) {
        return handleAppError(error, config.isDevMode, logger, context);
      }
    },
  });
  router.addProcedure(NetNusnoGyokaFeedMovePosts.mainSchema, {
    async handler({ request, input }) {
      const context: Record<string, unknown> = {
        operation: 'movePosts',
        stage: 'auth',
        postCount: input.posts.length,
        placement: input.placement.type,
        expectedRevision: input.expectedRevision,
      };
      try {
        await requireAuth(request, 'net.nusno.gyoka.feed.movePosts');
        const response = await movePosts(envMap.get(request)!.DB, input, context);
        logger.debug('feed.move.posts.success', context);
        return response;
      } catch (error) {
        return handleAppError(error, config.isDevMode, logger, context);
      }
    },
  });
  router.addProcedure(NetNusnoGyokaFeedRemovePosts.mainSchema, {
    async handler({ request, input }) {
      const context: Record<string, unknown> = {
        operation: 'removePosts',
        stage: 'auth',
        postCount: input.uris.length,
      };
      try {
        await requireAuth(request, 'net.nusno.gyoka.feed.removePosts');
        const response = await removePosts(envMap.get(request)!.DB, input, context);
        logger.debug('feed.remove.posts.success', context);
        return response;
      } catch (error) {
        return handleAppError(error, config.isDevMode, logger, context);
      }
    },
  });
  router.addProcedure(NetNusnoGyokaFeedRemovePostsByAuthor.mainSchema, {
    async handler({ request, input }) {
      const context: Record<string, unknown> = { operation: 'removePostsByAuthor', stage: 'auth' };
      try {
        await requireAuth(request, 'net.nusno.gyoka.feed.removePostsByAuthor');
        const response = await removePostsByAuthor(envMap.get(request)!.DB, input, context);
        logger.debug('feed.remove.author.success', context);
        return response;
      } catch (error) {
        return handleAppError(error, config.isDevMode, logger, context);
      }
    },
  });
  router.addProcedure(NetNusnoGyokaFeedTrimPosts.mainSchema, {
    async handler({ request, input }) {
      const context: Record<string, unknown> = {
        operation: 'trimPosts',
        stage: 'auth',
        remain: input.remain,
      };
      try {
        await requireAuth(request, 'net.nusno.gyoka.feed.trimPosts');
        const response = await trimPosts(envMap.get(request)!.DB, input, context);
        logger.debug('feed.trim.posts.success', context);
        return response;
      } catch (error) {
        return handleAppError(error, config.isDevMode, logger, context);
      }
    },
  });
  router.addProcedure(NetNusnoGyokaFeedPrunePostsBefore.mainSchema, {
    async handler({ request, input }) {
      const context: Record<string, unknown> = { operation: 'prunePostsBefore', stage: 'auth' };
      try {
        await requireAuth(request, 'net.nusno.gyoka.feed.prunePostsBefore');
        const response = await prunePostsBefore(envMap.get(request)!.DB, input, context);
        logger.debug('feed.prune.posts.success', context);
        return response;
      } catch (error) {
        return handleAppError(error, config.isDevMode, logger, context);
      }
    },
  });
  router.addProcedure(NetNusnoGyokaFeedRebalanceOrder.mainSchema, {
    async handler({ request, input }) {
      const context: Record<string, unknown> = { operation: 'rebalanceOrder', stage: 'auth' };
      try {
        await requireAuth(request, 'net.nusno.gyoka.feed.rebalanceOrder');
        return await rebalanceOrder(envMap.get(request)!.DB, input, context, logger);
      } catch (error) {
        return handleAppError(error, config.isDevMode, logger, context);
      }
    },
  });

  router.addProcedure(NetNusnoGyokaDocumentUpdateDocument.mainSchema, {
    async handler({ request, input }) {
      const context: Record<string, unknown> = {
        operation: 'updateDocument',
        stage: 'auth',
        docType: input.docType,
        hasUrl: input.url != null,
        hasContent: input.content != null,
      };
      try {
        await requireAuth(request, 'net.nusno.gyoka.document.updateDocument');
        context.stage = 'write';
        const response = await updateDocument(envMap.get(request)!.DB, {
          docType: input.docType as 'tos' | 'privacy_policy',
          url: input.url,
          content: input.content,
        });
        logger.debug('document.update.document.success', context);
        return response;
      } catch (error) {
        return handleAppError(error, config.isDevMode, logger, context);
      }
    },
  });

  return router;
}
