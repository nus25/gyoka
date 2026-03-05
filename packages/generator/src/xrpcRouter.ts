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
  const requiredAuth = workerEnv.FEEDGEN_AUTH_REQUIRED === 'enabled';
  const ttlSeconds = resolveDidCacheTtlSeconds(workerEnv.DID_CACHE_TTL_SECONDS);
  const requireAuth = createRequireAuth(requiredAuth, workerEnv.FEEDGEN_HOST, ttlSeconds, logger);
  const router = new XRPCRouter({
    handleException: (error) =>
      handleAppError(error, workerEnv.DEVELOPER_MODE === 'enabled', logger),
  });

  router.addQuery(AppBskyFeedGetFeedSkeleton.mainSchema, {
    async handler({ params, request }) {
      await requireAuth(request, 'app.bsky.feed.getFeedSkeleton');

      return getFeedSkeleton({
        env: envMap.get(request)!,
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
