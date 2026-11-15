import { AppBskyFeedGetFeedSkeleton, AppBskyFeedDescribeFeedGenerator } from '@atcute/bluesky';
import { XRPCRouter } from '@atcute/xrpc-server';
import { Logger } from 'shared/src/logger';

import { createRequireAuth } from './auth/createRequireAuth';
import { resolveDidCacheTtlSeconds } from './auth/didResolverFetch';
import { describeFeedGenerator } from './endpoints/describeFeedGenerator';
import { getFeedSkeleton } from './endpoints/getFeedSkeleton';
import { handleAppError } from './errorHandler';

type InvalidRequestPayload = {
  error?: string;
  message?: string;
  'net.kelinci.atcute.issues'?: unknown;
};

// remove atcute detailed validation issues from response
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
      const context: Record<string, unknown> = {
        operation: 'getFeedSkeleton',
        stage: 'auth',
        limit: params.limit,
        hasCursor: !!params.cursor,
      };
      try {
        await requireAuth(request, 'app.bsky.feed.getFeedSkeleton');

        context.stage = 'validation';
        return await getFeedSkeleton({
          env: envMap.get(request)!,
          request,
          feed: params.feed,
          limit: params.limit,
          cursor: params.cursor,
          context,
          logger,
        });
      } catch (error) {
        return handleAppError(error, isDevMode, logger, context);
      }
    },
  });

  router.addQuery(AppBskyFeedDescribeFeedGenerator.mainSchema, {
    async handler({ request }) {
      const context: Record<string, unknown> = {
        operation: 'describeFeedGenerator',
        stage: 'auth',
      };
      try {
        await requireAuth(request, 'app.bsky.feed.describeFeedGenerator');
        const env = envMap.get(request)!;
        const response = await describeFeedGenerator(env, context);
        if (env.DEVELOPER_MODE === 'enabled')
          logger.debug('feed.describe.generator.success', context);
        return response;
      } catch (error) {
        return handleAppError(error, isDevMode, logger, context);
      }
    },
  });

  return router;
}
