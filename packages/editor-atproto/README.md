# Gyoka-editor-atproto

(Beta version)
Worker for gyoka management endpoint for registering feeds and managing posts/documents on AT Protocol.

## Authentication

XRPC authentication Service Proxying, Inter-Service Authentication (JWT) are supported.
https://atproto.com/ja/specs/xrpc#authentication

## API endpoints

See `gyoka/packages/editor-atproto/lexicons` for more details.

- `GET /xrpc/net.nusno.gyoka.ping`
- `GET /xrpc/net.nusno.gyoka.feed.listFeeds`
- `POST /xrpc/net.nusno.gyoka.feed.registerFeed`
- `POST /xrpc/net.nusno.gyoka.feed.unregisterFeed`
- `POST /xrpc/net.nusno.gyoka.feed.updateFeed`
- `POST /xrpc/net.nusno.gyoka.feed.addPost`
- `POST /xrpc/net.nusno.gyoka.feed.batchAddPosts`
- `POST /xrpc/net.nusno.gyoka.feed.removePost`
- `POST /xrpc/net.nusno.gyoka.feed.batchRemovePosts`
- `POST /xrpc/net.nusno.gyoka.feed.removePostByAuthor`
- `GET /xrpc/net.nusno.gyoka.feed.getPosts`
- `POST /xrpc/net.nusno.gyoka.feed.trimPosts`
- `POST /xrpc/net.nusno.gyoka.document.updateDocument`

## Runtime variables

- `GYOKA_EDITOR_HOST`
  - service host name used to build service DID (`did:web:{host}`)
  - must be a valid AT Protocol handle format
- `GYOKA_EDITOR_AUTH_REQUIRED`
  - controls whether XRPC authentication is required
  - `disabled`: authentication is not required
  - any other value (for example `enabled`): authentication is required
- `GYOKA_EDITOR_ADMIN_DIDS`
  - comma-separated admin DID list (issuer allowlist)
  - used when authentication is required; caller DID must be included in this list
- `DID_CACHE_TTL_SECONDS`
  - DID document cache TTL in seconds for DID resolver fetches
  - positive integer string, default is `86400` (24h) when unset or invalid
- `DEVELOPER_MODE`
  - `enabled`: verbose debug behavior
  - `disabled`: production-safe behavior (default)
- `MAX_BATCH_POSTS`
  - max posts accepted by `batchAddPosts`
  - integer string (`>= 1`), default is `25`

## Local development

Run from repository root:

```sh
pnpm editor-atproto dev
```

If needed, initialize local D1 first:

```sh
pnpm editor-atproto d1-init:local
pnpm editor-atproto d1-add-sample:local
```

## Test

Run from repository root:

```sh
pnpm editor-atproto test run
pnpm editor-atproto coverage
```

## Deploy

1. Update production settings in `wrangler.jsonc`.

- Set `routes`/`workers_dev` for your domain. See [types of routes](https://developers.cloudflare.com/workers/wrangler/configuration/#types-of-routes) for details.
- Set production `vars`
- Set the `database_id` returned by `pnpm d1-create`:

  ```jsonc
    "d1_databases": [
      {
        "binding": "DB",
        "database_name": "gyoka-db",
        "database_id": "xxxx-xxxx-xxxx-xxxx-xxxx"
      }
    ]
  ```

2. Deploy from repository root.

```sh
pnpm editor-atproto run deploy
```
