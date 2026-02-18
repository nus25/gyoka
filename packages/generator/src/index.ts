import { fromHono } from 'chanfana';
import { Hono } from 'hono';
import { etag } from 'hono/etag';
import { cors } from 'hono/cors';
import { DescribeFeedGenerator } from './endpoints/app/bsky/feed/describeFeedGenerator';
import { GetFeedSkeleton } from './endpoints/app/bsky/feed/getFeedSkeleton';
import { GetDidDocument } from './endpoints/getDidDocument';
import { GetDocument } from './endpoints/getDocument';
import { AppContext } from 'shared/src/types';
import { createErrorResponse } from 'shared/src/errors';
import { GyokaBaseError, InternalServerError } from 'shared/src/errors';
import { createLogger } from 'shared/src/logger';

const OPENAPI_DOCS_ENABLED = __OPENAPI_DOCS_ENABLED__;
const app = new Hono();
const logger = createLogger({ service: 'generator' });

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: OPENAPI_DOCS_ENABLED ? '/docs' : null,
  redoc_url: OPENAPI_DOCS_ENABLED ? '/redocs' : null,
  openapi_url: OPENAPI_DOCS_ENABLED ? '/openapi.json' : null,
});

app.use('*', etag());
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET'],
  })
);

// configuration check for each endpoint
app.use('*', async (c: AppContext, next) => {
  if (!c.env.FEEDGEN_PUBLISHER_DID || !c.env.FEEDGEN_HOST) {
    throw new InternalServerError('Missing required environment variables');
  }
  if (!c.env.DB) {
    throw new InternalServerError('Missing database configuration');
  }
  await next();
});

openapi.get('/doc/:type', GetDocument);
// DID Document endpoint (W3C DID Core Specification)
openapi.get('/.well-known/did.json', GetDidDocument);
// Feed Generator description endpoint (AT Protocol Lexicon)
openapi.get('/xrpc/app.bsky.feed.describeFeedGenerator', DescribeFeedGenerator);
// Feed Skeleton endpoint (AT Protocol Lexicon)
openapi.get('/xrpc/app.bsky.feed.getFeedSkeleton', GetFeedSkeleton);

// Global error handler
app.onError((err, c) => {
  if (err instanceof GyokaBaseError) {
    const level = err.status >= 500 ? 'error' : 'warn';
    const details: Record<string, unknown> = {
      errorCode: err.errorCode,
      status: err.status,
      message: err.message,
    };

    // @ts-expect-error: 'DEVELOPER_MODE' may not exist on 'env' in some environments
    if (c.env.DEVELOPER_MODE === 'enabled') {
      details.stack = err.stack;
    }

    logger[level]('api.handle.exception.failed', details);
    return createErrorResponse(err.errorCode, err.message, err.status);
  }

  // For other errors, return a generic 500 response
  logger.error('api.handle.unexpected.failed', {
    err,
  });
  return createErrorResponse('InternalServerError', 'An unexpected error occurred.', 500);
});

export default app;
