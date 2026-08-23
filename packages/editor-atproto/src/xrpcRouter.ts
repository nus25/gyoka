import { XRPCRouter } from '@atcute/xrpc-server';
import { Logger } from 'shared/src/logger';

import { createRequireAuth } from './auth/createRequireAuth';
import { addPost } from './endpoints/addPost';
import { batchAddPosts } from './endpoints/batchAddPosts';
import { batchRemovePosts } from './endpoints/batchRemovePosts';
import { getDocument } from './endpoints/getDocument';
import { getPosts } from './endpoints/getPosts';
import { listFeeds } from './endpoints/listFeeds';
import { ping } from './endpoints/ping';
import { registerFeed } from './endpoints/registerFeed';
import { removePost } from './endpoints/removePost';
import { removePostByAuthor } from './endpoints/removePostByAuthor';
import { trimFeed } from './endpoints/trimFeed';
import { unregisterFeed } from './endpoints/unregisterFeed';
import { updateDocument } from './endpoints/updateDocument';
import { updateFeed } from './endpoints/updateFeed';
import { handleAppError } from './errorHandler';
import {
  NetNusnoGyokaDocumentGetDocument,
  NetNusnoGyokaDocumentUpdateDocument,
  NetNusnoGyokaFeedAddPost,
  NetNusnoGyokaFeedBatchAddPosts,
  NetNusnoGyokaFeedBatchRemovePosts,
  NetNusnoGyokaFeedGetPosts,
  NetNusnoGyokaFeedListFeeds,
  NetNusnoGyokaFeedRegisterFeed,
  NetNusnoGyokaFeedRemovePost,
  NetNusnoGyokaFeedRemovePostByAuthor,
  NetNusnoGyokaFeedTrimFeed,
  NetNusnoGyokaFeedUnregisterFeed,
  NetNusnoGyokaFeedUpdateFeed,
  NetNusnoGyokaPing,
} from './lexicons';

export type XrpcRuntimeConfig = {
  isDevMode: boolean;
  requiredAuth: boolean;
  host: string;
  adminDids: string;
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
    message: payload.message,
    issues,
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
      try {
        await requireAuth(request, 'net.nusno.gyoka.ping');
        return ping();
      } catch (error) {
        return handleAppError(error, config.isDevMode, logger);
      }
    },
  });

  router.addQuery(NetNusnoGyokaFeedListFeeds.mainSchema, {
    async handler({ request }) {
      try {
        await requireAuth(request, 'net.nusno.gyoka.feed.listFeeds');
        return await listFeeds(envMap.get(request)!.DB);
      } catch (error) {
        return handleAppError(error, config.isDevMode, logger);
      }
    },
  });

  router.addQuery(NetNusnoGyokaDocumentGetDocument.mainSchema, {
    async handler({ request, params }) {
      try {
        await requireAuth(request, 'net.nusno.gyoka.document.getDocument');
        return await getDocument(envMap.get(request)!.DB, {
          docType: params.docType,
        });
      } catch (error) {
        return handleAppError(error, config.isDevMode, logger);
      }
    },
  });

  router.addProcedure(NetNusnoGyokaFeedRegisterFeed.mainSchema, {
    async handler({ request, input }) {
      try {
        await requireAuth(request, 'net.nusno.gyoka.feed.registerFeed');
        return await registerFeed(envMap.get(request)!.DB, {
          uri: input.uri,
          langFilter: input.langFilter,
          isActive: input.isActive,
        });
      } catch (error) {
        return handleAppError(error, config.isDevMode, logger);
      }
    },
  });

  router.addProcedure(NetNusnoGyokaFeedUpdateFeed.mainSchema, {
    async handler({ request, input }) {
      try {
        await requireAuth(request, 'net.nusno.gyoka.feed.updateFeed');
        return await updateFeed(envMap.get(request)!.DB, {
          uri: input.uri,
          langFilter: input.langFilter,
          isActive: input.isActive,
        });
      } catch (error) {
        return handleAppError(error, config.isDevMode, logger);
      }
    },
  });

  router.addProcedure(NetNusnoGyokaFeedUnregisterFeed.mainSchema, {
    async handler({ request, input }) {
      try {
        await requireAuth(request, 'net.nusno.gyoka.feed.unregisterFeed');
        return await unregisterFeed(envMap.get(request)!.DB, { uri: input.uri });
      } catch (error) {
        return handleAppError(error, config.isDevMode, logger);
      }
    },
  });

  router.addProcedure(NetNusnoGyokaFeedTrimFeed.mainSchema, {
    async handler({ request, input }) {
      try {
        await requireAuth(request, 'net.nusno.gyoka.feed.trimFeed');
        return await trimFeed(envMap.get(request)!.DB, {
          feed: input.feed,
          remain: input.remain,
        });
      } catch (error) {
        return handleAppError(error, config.isDevMode, logger);
      }
    },
  });

  router.addProcedure(NetNusnoGyokaFeedRemovePostByAuthor.mainSchema, {
    async handler({ request, input }) {
      try {
        await requireAuth(request, 'net.nusno.gyoka.feed.removePostByAuthor');
        return await removePostByAuthor(envMap.get(request)!.DB, {
          feed: input.feed,
          author: input.author,
        });
      } catch (error) {
        return handleAppError(error, config.isDevMode, logger);
      }
    },
  });

  router.addProcedure(NetNusnoGyokaFeedRemovePost.mainSchema, {
    async handler({ request, input }) {
      try {
        await requireAuth(request, 'net.nusno.gyoka.feed.removePost');
        return await removePost(envMap.get(request)!.DB, {
          feed: input.feed,
          post: {
            uri: input.post.uri,
            indexedAt: input.post.indexedAt,
          },
        });
      } catch (error) {
        return handleAppError(error, config.isDevMode, logger);
      }
    },
  });

  router.addQuery(NetNusnoGyokaFeedGetPosts.mainSchema, {
    async handler({ request, params }) {
      try {
        await requireAuth(request, 'net.nusno.gyoka.feed.getPosts');
        return await getPosts(envMap.get(request)!.DB, {
          feed: params.feed,
          limit: params.limit,
          cursor: params.cursor,
        });
      } catch (error) {
        return handleAppError(error, config.isDevMode, logger);
      }
    },
  });

  router.addProcedure(NetNusnoGyokaFeedAddPost.mainSchema, {
    async handler({ request, input }) {
      try {
        await requireAuth(request, 'net.nusno.gyoka.feed.addPost');
        return await addPost(envMap.get(request)!.DB, {
          feed: input.feed,
          post: {
            uri: input.post.uri,
            cid: input.post.cid,
            languages: input.post.languages,
            indexedAt: input.post.indexedAt,
            feedContext: input.post.feedContext,
            reason: input.post.reason as { $type: string; repost?: string } | undefined,
          },
        });
      } catch (error) {
        return handleAppError(error, config.isDevMode, logger);
      }
    },
  });

  router.addProcedure(NetNusnoGyokaFeedBatchAddPosts.mainSchema, {
    async handler({ request, input }) {
      try {
        await requireAuth(request, 'net.nusno.gyoka.feed.batchAddPosts');
        return await batchAddPosts(envMap.get(request)!, {
          entries: input.entries,
        });
      } catch (error) {
        return handleAppError(error, config.isDevMode, logger);
      }
    },
  });

  router.addProcedure(NetNusnoGyokaFeedBatchRemovePosts.mainSchema, {
    async handler({ request, input }) {
      try {
        await requireAuth(request, 'net.nusno.gyoka.feed.batchRemovePosts');
        return await batchRemovePosts(envMap.get(request)!, {
          entries: input.entries,
        });
      } catch (error) {
        return handleAppError(error, config.isDevMode, logger);
      }
    },
  });

  router.addProcedure(NetNusnoGyokaDocumentUpdateDocument.mainSchema, {
    async handler({ request, input }) {
      try {
        await requireAuth(request, 'net.nusno.gyoka.document.updateDocument');
        return await updateDocument(envMap.get(request)!.DB, {
          docType: input.docType as 'tos' | 'privacy_policy',
          url: input.url,
          content: input.content,
        });
      } catch (error) {
        return handleAppError(error, config.isDevMode, logger);
      }
    },
  });

  return router;
}
