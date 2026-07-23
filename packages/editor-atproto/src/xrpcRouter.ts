import { XRPCRouter } from '@atcute/xrpc-server';
import { Logger } from 'shared/src/logger';

import { createRequireAuth } from './auth/createRequireAuth';
import { listFeeds } from './endpoints/listFeeds';
import { ping } from './endpoints/ping';
import { registerFeed } from './endpoints/registerFeed';
import { handleAppError } from './errorHandler';
import {
  NetNusnoGyokaFeedListFeeds,
  NetNusnoGyokaFeedRegisterFeed,
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

  return router;
}
