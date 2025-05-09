import { fromHono, ApiException } from 'chanfana';
import { Hono } from 'hono';
import { etag } from 'hono/etag';
import { cors } from 'hono/cors';
import { DescribeFeedGenerator } from './endpoints/app/bsky/feed/describeFeedGenerator';
import { GetFeedSkeleton } from './endpoints/app/bsky/feed/getFeedSkeleton';
import { GetDidDocument } from './endpoints/getDidDocument';
import { GetDocument } from './endpoints/getDocument';
import { AppContext, createErrorResponse } from 'shared/src/types';

const app = new Hono();

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: '/',
  redoc_url: '/redocs',
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
    throw new ApiException('Missing required environment variables');
  }
  if (!c.env.DB) {
    throw new ApiException('Missing database configuration');
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
  if (err instanceof ApiException) {
    console.error('API Exception:', err.message, err.status);
    // @ts-expect-error: 'DEVELOPER_MODE' may not exist on 'env' in some environments
    if (c.env.DEVELOPER_MODE === 'enabled') {
      console.error(err.stack);
    }

    let error = '';
    switch (err.status) {
      case 400:
        error = 'BadRequest';
        break;
      case 404:
        error = 'NotFound';
        break;
      case 500:
        error = 'InternalServerError';
        break;
      default:
        console.error(err);
        error = err.default_message;
        err.message = 'Unexpected error occurred.';
    }
    const resp = createErrorResponse(error, err.message, err.status);
    return resp;
  }

  // For other errors, return a generic 500 response
  console.error(err);
  const resp = createErrorResponse('InternalServerError', 'An unexpected error occurred.', 500);
  return resp;
});

export default app;
