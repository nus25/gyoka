import { type Nsid } from '@atcute/lexicons';
import { normalizeWebDid } from '@atcute/identity';
import { isDid, isHandle } from '@atcute/lexicons/syntax';
import { AuthRequiredError, XRPCRouter } from '@atcute/xrpc-server';
import { ServiceJwtVerifier, type VerifiedJwt } from '@atcute/xrpc-server/auth';
import { cors } from '@atcute/xrpc-server/middlewares/cors';

import {
  CompositeDidDocumentResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
} from '@atcute/identity-resolver';

import { AppBskyFeedGetFeedSkeleton, AppBskyFeedDescribeFeedGenerator } from '@atcute/bluesky';
import { describeFeedGenerator } from './endpoints/app/bsky/feed/describeFeedGenerator';
import { getFeedSkeleton } from './endpoints/app/bsky/feed/getFeedSkeleton';
import { getDidDocument } from './endpoints/getDidDocument';
import { getDocument } from './endpoints/getDocument';
import { createErrorResponse } from 'shared/src/errors';
import { GyokaBaseError, InternalServerError } from 'shared/src/errors';
import { createLogger } from 'shared/src/logger';

const logger = createLogger({ service: 'generator' });

type InvalidRequestPayload = {
  error?: string;
  message?: string;
  'net.kelinci.atcute.issues'?: unknown;
};

function handleAppError(err: unknown, env?: Env): Response {
  if (err instanceof GyokaBaseError) {
    const level = err.status >= 500 ? 'error' : 'warn';
    const details: Record<string, unknown> = {
      errorCode: err.errorCode,
      status: err.status,
      message: err.message,
    };

    if (env?.DEVELOPER_MODE === 'enabled') {
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

function createRequireAuth(env: Env) {
  const serviceDid = normalizeWebDid(`did:web:${env.FEEDGEN_HOST}`);
  const didDocResolver = new CompositeDidDocumentResolver({
    methods: {
      plc: new PlcDidDocumentResolver(),
      web: new WebDidDocumentResolver(),
    },
  });

  const jwtVerifier = new ServiceJwtVerifier({
    serviceDid,
    resolver: didDocResolver,
  });

  return async (request: Request, lxm: Nsid): Promise<VerifiedJwt | null> => {
    if (env.FEEDGEN_AUTH_REQUIRED !== 'enabled') {
      return null;
    }

    const auth = request.headers.get('authorization');
    if (auth === null) {
      throw new AuthRequiredError({ description: 'missing authorization header' });
    }
    if (!auth.startsWith('Bearer ')) {
      throw new AuthRequiredError({ description: 'invalid authorization scheme' });
    }

    const jwtString = auth.slice('Bearer '.length).trim();

    const result = await jwtVerifier.verify(jwtString, { lxm });
    if (!result.ok) {
      if ('error' in result) {
        throw new AuthRequiredError(result.error);
      }
      throw new AuthRequiredError({ description: 'invalid authorization token' });
    }

    return result.value;
  };
}

function createRouter(env: Env): XRPCRouter {
  const requireAuth = createRequireAuth(env);
  const router = new XRPCRouter({
    middlewares: [cors()],
    handleException: (error) => handleAppError(error, env),
  });

  router.addQuery(AppBskyFeedGetFeedSkeleton.mainSchema, {
    async handler({ params, request }) {
      await requireAuth(request, 'app.bsky.feed.getFeedSkeleton');

      return getFeedSkeleton({
        env,
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
      return describeFeedGenerator(env);
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      assertRequiredConfiguration(env);

      const url = new URL(request.url);

      if (request.method === 'GET' && url.pathname === '/.well-known/did.json') {
        return getDidDocument(env);
      }

      if (request.method === 'GET') {
        const docMatch = /^\/doc\/([^/]+)$/.exec(url.pathname);
        if (docMatch) {
          return getDocument(env, decodeURIComponent(docMatch[1]));
        }
      }

      const router = createRouter(env);
      const routerResponse = await router.fetch(request);
      return sanitizeAtcuteValidationResponse(routerResponse);
    } catch (err) {
      return handleAppError(err, env);
    }
  },
} satisfies ExportedHandler;
