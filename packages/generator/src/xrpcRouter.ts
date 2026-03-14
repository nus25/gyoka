import { AppBskyFeedGetFeedSkeleton, AppBskyFeedDescribeFeedGenerator } from '@atcute/bluesky';
import { XRPCRouter } from '@atcute/xrpc-server';
import { Logger } from 'shared/src/logger';

import { createRequireAuth } from './auth/createRequireAuth';
import { resolveDidCacheTtlSeconds } from './auth/didResolverFetch';
import { describeFeedGenerator } from './endpoints/app/bsky/feed/describeFeedGenerator';
import { getFeedSkeleton } from './endpoints/app/bsky/feed/getFeedSkeleton';
import { handleAppError } from './errorHandler';

type InvalidRequestPayload = {
  error?: string;
  message?: string;
  'net.kelinci.atcute.issues'?: unknown;
};

// remove atcute detailed validation issues from response but log them for debugging
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

  const sanitized = {
    error: 'BadRequest', // gyoka returns 400 as BadRequest
    message: payload.message,
  };

  const headers = new Headers(response.headers);
  headers.delete('content-length');

  return new Response(JSON.stringify(sanitized), {
    status: response.status,
    headers,
  });
}

export function createXrpcRouter(
  workerEnv: Env,
  envMap: WeakMap<Request, Env>,
  logger: Logger
): XRPCRouter {
  const isDevMode = workerEnv.DEVELOPER_MODE === 'enabled';
  const requiredAuth = workerEnv.FEEDGEN_AUTH_REQUIRED !== 'disabled';
  const ttlSeconds = resolveDidCacheTtlSeconds(workerEnv.DID_CACHE_TTL_SECONDS);
  const requireAuth = createRequireAuth(requiredAuth, workerEnv.FEEDGEN_HOST, ttlSeconds, logger);
  const router = new XRPCRouter({
    handleException: (error) => handleAppError(error, isDevMode, logger),
  });

  router.addQuery(AppBskyFeedGetFeedSkeleton.mainSchema, {
    async handler({ params, request }) {
      try {
        await requireAuth(request, 'app.bsky.feed.getFeedSkeleton');

        return await getFeedSkeleton({
          env: envMap.get(request)!,
          request,
          feed: params.feed,
          limit: params.limit,
          cursor: params.cursor,
        });
      } catch (error) {
        return handleAppError(error, isDevMode, logger);
      }
    },
  });

  router.addQuery(AppBskyFeedDescribeFeedGenerator.mainSchema, {
    async handler({ request }) {
      try {
        await requireAuth(request, 'app.bsky.feed.describeFeedGenerator');
        return await describeFeedGenerator(envMap.get(request)!);
      } catch (error) {
        return handleAppError(error, isDevMode, logger);
      }
    },
  });

  return router;
}
