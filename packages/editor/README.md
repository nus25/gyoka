# gyoka-editor

Private management API worker for registering feeds and managing posts/documents.

## Authentication

- If `GYOKA_API_KEY` secret is configured, all `/api/*` endpoints require `X-API-Key` header.
- For local development, set secret in `packages/editor/.dev.vars`.
- For production, set secret with Wrangler:

```sh
pnpm --dir packages/editor wrangler secret put GYOKA_API_KEY --env production
```

## API endpoints

- `GET /api/feed/listFeeds`
- `POST /api/feed/registerFeed`
- `POST /api/feed/unregisterFeed`
- `POST /api/feed/updateFeed`
- `POST /api/feed/trimPosts`
- `POST /api/feed/addPost`
- `POST /api/feed/batchAddPosts`
- `POST /api/feed/removePost`
- `POST /api/feed/batchRemovePosts`
- `POST /api/feed/removePostByAuthor`
- `GET /api/feed/getPosts`
- `GET /api/gyoka/ping`
- `POST /api/gyoka/updateDocument`

## OpenAPI docs

OpenAPI routes are available when `__OPENAPI_DOCS_ENABLED__` is `true`.

- `/docs`
- `/redocs`
- `/openapi.json`

## Runtime variables

- `DEVELOPER_MODE`
  - `enabled`: verbose debug behavior
  - `disabled`: production-safe behavior
- `MAX_BATCH_POSTS`
  - max posts accepted by `batchAddPosts`
  - integer string (`>= 1`), example: `25`

## Local development

Run from repository root:

```sh
pnpm editor dev
```

If needed, initialize local D1 first:

```sh
pnpm d1-init:local
pnpm d1-add-sample:local
```

## Test

Run from repository root:

```sh
pnpm editor test run
pnpm editor coverage
```

## Deploy

1. Update production settings in `wrangler.jsonc`.
   - Set `routes`/`workers_dev` for your domain
   - Set `vars` (`DEVELOPER_MODE`, `MAX_BATCH_POSTS`, `VERSION`, `GIT_SHA`)
   - Set production `d1_databases[0].database_id`

2. Set API key secret for production.

```sh
pnpm --dir packages/editor wrangler secret put GYOKA_API_KEY --env production
```

3. Deploy from repository root.

```sh
pnpm editor run deploy
```

## Related docs

- root onboarding: [../../README.md](../../README.md)
- feed editing flow: [../../docs/edit-feed.md](../../docs/edit-feed.md)
- generator API counterpart: [../generator/README.md](../generator/README.md)
