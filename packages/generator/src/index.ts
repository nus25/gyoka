import { isDid, isHandle } from '@atcute/lexicons/syntax';
import { XRPCError, XRPCRouter } from '@atcute/xrpc-server';
import { cors } from '@atcute/xrpc-server/middlewares/cors';

import { AppBskyFeedGetFeedSkeleton, AppBskyFeedDescribeFeedGenerator } from '@atcute/bluesky';
import { createRequireAuth } from './auth/createRequireAuth';
import { describeFeedGenerator } from './endpoints/app/bsky/feed/describeFeedGenerator';
import { getFeedSkeleton } from './endpoints/app/bsky/feed/getFeedSkeleton';
import { getDidDocument } from './endpoints/getDidDocument';
import { getDocument } from './endpoints/getDocument';
import { createErrorResponse } from 'shared/src/errors/core';
import { GyokaBaseError, InternalServerError } from 'shared/src/errors/core';
import { createLogger, Logger } from 'shared/src/logger';
import { env as cloudflareEnv} from 'cloudflare:workers'
import { resolveDidCacheTtlSeconds } from './auth/didResolverCache';

const logger = createLogger({
  service: 'generator',
  minLevel: cloudflareEnv.DEVELOPER_MODE === 'enabled' ? 'debug' : 'info',
});

type InvalidRequestPayload = {
  error?: string;
  message?: string;
  'net.kelinci.atcute.issues'?: unknown;
};

function handleAppError(err: unknown, devMode: boolean): Response {
  if (err instanceof XRPCError) {
    const level = err.status >= 500 ? 'error' : 'warn';
    const details: Record<string, unknown> = {
      errorCode: err.error,
      status: err.status,
      message: err.description,
    };

    if (devMode) {
      details.stack = err.stack;
    }

    logger[level]('api.handle.exception.failed', details);
    return err.toResponse();
  }

  if (err instanceof GyokaBaseError) {
    const level = err.status >= 500 ? 'error' : 'warn';
    const details: Record<string, unknown> = {
      errorCode: err.errorCode,
      status: err.status,
      message: err.message,
    };

    if (devMode) {
      details.stack = err.stack;
    }

    logger[level]('api.handle.exception.failed', details);
    return createErrorResponse(err.errorCode, err.message, err.status);
  }

  logger.error('api.handle.unexpected.failed', {
    err,
  });
  return createErrorResponse('InternalServerError', 'An unexpected error occurred.', 500);
}

function assertRequiredConfiguration(env: Env): void {
  if (!env.FEEDGEN_PUBLISHER_DID || !env.FEEDGEN_HOST) {
    throw new InternalServerError('Missing required environment variables');
  }
  if (!env.DB) {
    throw new InternalServerError('Missing database configuration');
  }

  if (!isDid(env.FEEDGEN_PUBLISHER_DID) || !isHandle(env.FEEDGEN_HOST)) {
    throw new InternalServerError('Invalid required environment variables');
  }
}

const envMap = new WeakMap<Request, Env>();

export function createRouter(env: Env, logger: Logger): XRPCRouter {
  const requiredAuth = env.FEEDGEN_AUTH_REQUIRED === 'enabled';
  const ttlSeconds = resolveDidCacheTtlSeconds(env.DID_CACHE_TTL_SECONDS);
  const requireAuth = createRequireAuth(requiredAuth, env.FEEDGEN_HOST, ttlSeconds, logger);
  const router = new XRPCRouter({
    middlewares: [cors()],
    handleException: (error) => handleAppError(error, env.DEVELOPER_MODE === 'enabled'),
  });

  router.addQuery(AppBskyFeedGetFeedSkeleton.mainSchema, {
    async handler({ params, request }) {
      await requireAuth(request, 'app.bsky.feed.getFeedSkeleton');

      return getFeedSkeleton({
        env: envMap.get(request)!, // env should always be available in the map at this point
        request,
        feed: params.feed,
        limit: params.limit,
        cursor: params.cursor,
      });
    },
  });

  router.addQuery(AppBskyFeedDescribeFeedGenerator.mainSchema, {
    async handler({ request }) {
      await requireAuth(request, 'app.bsky.feed.describeFeedGenerator');
      return describeFeedGenerator(envMap.get(request)!);
    },
  });

  return router;
}

// remove atcute detailed validation issues from response but log them for debugging
async function sanitizeAtcuteValidationResponse(response: Response): Promise<Response> {
  if (response.status !== 400) {
    return response;
  }

  const contentType = response.headers.get('Content-Type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
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
    errorCode: payload.error,
    message: payload.message,
    issues,
  });

  const sanitized = {
    error: payload.error,
    message: payload.message,
  };

  const headers = new Headers(response.headers);
  headers.delete('content-length');

  return new Response(JSON.stringify(sanitized), {
    status: response.status,
    headers,
  });
}

const router = createRouter(cloudflareEnv, logger);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      assertRequiredConfiguration(env);

      const url = new URL(request.url);
      //  '/.well-known/did.json'
      if (request.method === 'GET' && url.pathname === '/.well-known/did.json') {
        return getDidDocument(env);
      }
      // '/doc/:id'
      if (request.method === 'GET') {
        const docMatch = /^\/doc\/([^/]+)$/.exec(url.pathname);
        if (docMatch) {
          return await getDocument(env, decodeURIComponent(docMatch[1]));
        }
      }
      // '/xrpc/:method' and others handled by router
      envMap.set(request, env);
      const routerResponse = await router.fetch(request);
      return await sanitizeAtcuteValidationResponse(routerResponse);
    } catch (err) {
      return handleAppError(err, env.DEVELOPER_MODE === 'enabled');
    }
  },
} satisfies ExportedHandler;
