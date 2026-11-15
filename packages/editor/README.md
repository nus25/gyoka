# Gyoka-editor

Worker for gyoka management endpoint for registering feeds and managing posts/documents on AT Protocol.

## Authentication

XRPC authentication Service Proxying, Inter-Service Authentication (JWT) are supported.
https://atproto.com/ja/specs/xrpc#authentication

## API endpoints

See `./lexicons` for more details.

- `GET /.well-known/did.json`
- `GET /xrpc/net.nusno.gyoka.ping`
- `POST /xrpc/net.nusno.gyoka.feed.registerFeed`
- `POST /xrpc/net.nusno.gyoka.feed.updateFeed`
- `POST /xrpc/net.nusno.gyoka.feed.unregisterFeed`
- `GET /xrpc/net.nusno.gyoka.feed.listFeeds`
- `POST /xrpc/net.nusno.gyoka.feed.putPosts`
- `POST /xrpc/net.nusno.gyoka.feed.movePosts`
- `POST /xrpc/net.nusno.gyoka.feed.removePosts`
- `POST /xrpc/net.nusno.gyoka.feed.removePostsByAuthor`
- `GET /xrpc/net.nusno.gyoka.feed.listPosts`
- `POST /xrpc/net.nusno.gyoka.feed.trimPosts`
- `POST /xrpc/net.nusno.gyoka.feed.prunePostsBefore`
- `POST /xrpc/net.nusno.gyoka.feed.rebalanceOrder`
- `GET /xrpc/net.nusno.gyoka.document.getDocument`
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
  - JSON array of admin DIDs (issuer allowlist)
  - used when authentication is required; caller DID must be included in this list
- `DID_CACHE_TTL_SECONDS`
  - DID document cache TTL in seconds for DID resolver fetches
  - positive integer string, default is `86400` (24h) when unset or invalid
- `DEVELOPER_MODE`
  - `enabled`: verbose debug behavior
  - `disabled`: production-safe behavior (default)

## Local development

Run from repository root:

```sh
pnpm editor dev
```

If needed, initialize local D1 first:

```sh
pnpm editor d1-init:local
pnpm editor d1-add-sample:local
```

## Test

Run from repository root:

```sh
pnpm editor test run
pnpm editor coverage
```

## Deploy

1. Update production settings in `wrangler.jsonc`.

- Set `routes`/`workers_dev` for your domain. See [types of routes](https://developers.cloudflare.com/workers/wrangler/configuration/#types-of-routes) for details.
- Set production `vars`
- Set the `database_id` of `gyoka-db-v1`. Running `pnpm d1-setup` from the repository root sets it automatically. To set it manually:

  ```jsonc
    "d1_databases": [
      {
        "binding": "DB",
        "database_id": "xxxx-xxxx-xxxx-xxxx-xxxx"
      }
    ]
  ```

2. Deploy from repository root.

```sh
pnpm editor run deploy
```
