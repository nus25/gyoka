import { fromHono, ApiException } from 'chanfana';
import { Hono } from 'hono';
import { etag } from 'hono/etag';
import { cors } from 'hono/cors';
import { Ping } from './endpoints/ping';
import { ListFeeds } from './endpoints/listFeeds';
import { RegisterFeed } from './endpoints/registerFeed';
import { UpdateFeed } from './endpoints/updateFeed';
import { UnregisterFeed } from './endpoints/unregisterFeed';
import { AddPost } from './endpoints/addPost';
import { RemovePost } from './endpoints/removePost';
import { GetPosts } from './endpoints/getPosts';
import { TrimFeed } from './endpoints/trimFeed';
import { UpdateDocument } from './endpoints/updateDocument';
import { AppContext, createErrorResponse } from 'shared/src/types';

const API_VERSION = '1.0.0';

// Start a Hono app
const app = new Hono<{ Bindings: EnvWithSecret }>();
// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: '/docs',
  redoc_url: '/redocs',
  openapiVersion: '3',
  schema: {
    info: {
      title: 'Gyoka API',
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
    throw new ApiException('Missing database configuration');
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
openapi.post('/api/feed/removePost', RemovePost);
openapi.get('/api/feed/getPosts', GetPosts);
openapi.get('/api/gyoka/ping', Ping);
openapi.post('/api/gyoka/updateDocument', UpdateDocument);

// Global error handler
app.onError((err, c) => {
  if (err instanceof ApiException) {
    console.error('API Exception:', err.message, err.status);
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

// Export the Hono app
export default app;
