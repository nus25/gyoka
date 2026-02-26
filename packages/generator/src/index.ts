import { isDid, isHandle } from '@atcute/lexicons/syntax';
import { getDidDocument } from './endpoints/getDidDocument';
import { getDocument } from './endpoints/getDocument';
import { InternalServerError } from 'shared/src/errors/core';
import { createLogger } from 'shared/src/logger';
import { env as workerEnv } from 'cloudflare:workers';
import { createXrpcRouter, sanitizeAtcuteValidationResponse } from './xrpcRouter';
import { handleAppError } from './errorHandler';

const logger = createLogger({
  service: 'generator',
  minLevel: workerEnv.DEVELOPER_MODE === 'enabled' ? 'debug' : 'info',
});

// closure to hold env map for request handlers since we can't pass env directly through router context
const envMap = new WeakMap<Request, Env>();

const xrpcRouter = createXrpcRouter(workerEnv, envMap, logger);

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
      envMap.set(request, env); // make env available to handlers
      const response = await xrpcRouter.fetch(request);
      return await sanitizeAtcuteValidationResponse(response, logger);
    } catch (err) {
      return handleAppError(err, env.DEVELOPER_MODE === 'enabled', logger);
    }
  },
} satisfies ExportedHandler;
