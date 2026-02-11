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
const app = new Hono();

// Guard OpenAPI UI routes by environment flags (before openapi setup)
app.use('/docs', async (c: AppContext, next) => {
  if (c.env.SWAGGER_UI !== 'enabled') return c.notFound();
  await next();
});
app.use('/redocs', async (c: AppContext, next) => {
  if (c.env.REDOC !== 'enabled') return c.notFound();
  await next();
});
app.use('/openapi.json', async (c: AppContext, next) => {
  const isDocsEnabled = c.env.SWAGGER_UI === 'enabled';
  const isRedocEnabled = c.env.REDOC === 'enabled';
  const isOpenapiJsonEnabled = c.env.OPENAPI_JSON === 'enabled';

  if (!isDocsEnabled && !isRedocEnabled && !isOpenapiJsonEnabled) {
    return c.notFound();
  }
  await next();
});

// Setup OpenAPI registry - routes always registered
const openapi = fromHono(app, {
  docs_url: '/docs',
  redoc_url: '/redocs',
  openapi_url: '/openapi.json',
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
    console.error('API Exception:', err.message, err.status);
    // @ts-expect-error: 'DEVELOPER_MODE' may not exist on 'env' in some environments
    if (c.env.DEVELOPER_MODE === 'enabled') {
      console.error(err.stack);
    }
    return createErrorResponse(err.errorCode, err.message, err.status);
  }

  // For other errors, return a generic 500 response
  console.error(err);
  return createErrorResponse('InternalServerError', 'An unexpected error occurred.', 500);
});

export default app;
