import { fromHono } from 'chanfana';
import { Hono } from 'hono';
import { etag } from 'hono/etag';
import { cors } from 'hono/cors';
import { Ping } from './endpoints/ping';
import { ListFeeds } from './endpoints/listFeeds';
import { RegisterFeed } from './endpoints/registerFeed';
import { UpdateFeed } from './endpoints/updateFeed';
import { UnregisterFeed } from './endpoints/unregisterFeed';
import { AddPost } from './endpoints/addPost';
import { BatchAddPosts } from './endpoints/batchAddPosts';
import { RemovePost } from './endpoints/removePost';
import { BatchRemovePosts } from './endpoints/batchRemovePosts';
import { RemovePostByAuthor } from './endpoints/removePostByAuthor';
import { GetPosts } from './endpoints/getPosts';
import { TrimFeed } from './endpoints/trimFeed';
import { UpdateDocument } from './endpoints/updateDocument';
import { AppContext } from 'shared/src/types';
import { GyokaBaseError, InternalServerError, createErrorResponse } from 'shared/src/errors';
import { createLogger } from 'shared/src/logger';

const API_VERSION = '1.2.1';
const OPENAPI_DOCS_ENABLED = __OPENAPI_DOCS_ENABLED__;
const logger = createLogger({ service: 'editor' });

// Start a Hono app
const app = new Hono<{ Bindings: EnvWithSecret }>();

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: OPENAPI_DOCS_ENABLED ? '/docs' : null,
  redoc_url: OPENAPI_DOCS_ENABLED ? '/redocs' : null,
  openapi_url: OPENAPI_DOCS_ENABLED ? '/openapi.json' : null,
  openapiVersion: '3',
  schema: {
    info: {
      title: 'Gyoka Editor API',
      version: API_VERSION,
    },
    security: [{ ApiKeyAuth: [] }],
  },
});
openapi.registry.registerComponent('securitySchemes', 'ApiKeyAuth', {
  type: 'apiKey',
  in: 'header',
  name: 'X-API-Key',
});

app.use('*', etag());
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST'],
  })
);
// configuration check for each endpoint
app.use('/api/*', async (c: AppContext, next) => {
  if (!c.env.DB) {
    throw new InternalServerError('Missing database configuration');
  }
  await next();
});
// api key auth
app.use('/api/*', async (c, next) => {
  if (c.env.GYOKA_API_KEY) {
    const apiKey = c.req.header('X-API-Key');
    if (!apiKey || apiKey !== c.env.GYOKA_API_KEY) {
      return c.json(
        { error: 'Unauthorized', message: 'Authentication credentials were missing or invalid.' },
        401
      );
    }
  }
  await next();
});
// Register OpenAPI endpoints
openapi.get('/api/feed/listFeeds', ListFeeds);
openapi.post('/api/feed/registerFeed', RegisterFeed);
openapi.post('/api/feed/unregisterFeed', UnregisterFeed);
openapi.post('/api/feed/updateFeed', UpdateFeed);
openapi.post('/api/feed/trimPosts', TrimFeed);
openapi.post('/api/feed/addPost', AddPost);
openapi.post('/api/feed/batchAddPosts', BatchAddPosts);
openapi.post('/api/feed/removePost', RemovePost);
openapi.post('/api/feed/batchRemovePosts', BatchRemovePosts);
openapi.post('/api/feed/removePostByAuthor', RemovePostByAuthor);
openapi.get('/api/feed/getPosts', GetPosts);
openapi.get('/api/gyoka/ping', Ping);
openapi.post('/api/gyoka/updateDocument', UpdateDocument);

// Global error handler
app.onError((err, c) => {
  if (err instanceof GyokaBaseError) {
    const level = err.status >= 500 ? 'error' : 'warn';
    const details: Record<string, unknown> = {
      errorCode: err.errorCode,
      status: err.status,
      message: err.message,
    };

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

// Export the Hono app
export default app;
