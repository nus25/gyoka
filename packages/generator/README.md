# gyoka-generator

Public feed generator worker for Bluesky AT Protocol.

## Endpoints

- `GET /.well-known/did.json`
- `GET /doc/{type}`
- `GET /xrpc/app.bsky.feed.describeFeedGenerator`
- `GET /xrpc/app.bsky.feed.getFeedSkeleton`

## Required environment variables

- `FEEDGEN_PUBLISHER_DID`
  - Must be a valid DID string (example: `did:plc:...`)
- `FEEDGEN_HOST`
  - Must be a valid host/handle string (example: `feed-generator.example.com`)
- `FEEDGEN_AUTH_REQUIRED`
  - `enabled`: require service JWT for generator XRPC endpoints (default)
  - `disabled`: skip JWT verification
- `DID_CACHE_TTL_SECONDS`
  - DID resolver cache TTL in seconds
  - default: `8686400` (1 day)
  - invalid values fallback to default
- `DEVELOPER_MODE`
  - `enabled`: include stack traces in logs/responses where applicable
  - `disabled`: production-safe logging
- `D1_USE_SESSION`
  - **Experimental**: enable D1 session in `getFeedSkeleton` endpoint for D1 read replication (beta).
  - `enabled`: use D1 session API
  - `disabled`: use standard D1 (default)

## Local development

Run from repository root:

```sh
pnpm generator dev
```

## Test

Run from repository root:

```sh
pnpm generator test run
pnpm generator coverage
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
pnpm generator run deploy
```

## Related docs

- root onboarding: [../../README.md](../../README.md)
- feed creation flow: [../../docs/create-feed.md](../../docs/create-feed.md)
- editor API counterpart: [../editor/README.md](../editor/README.md)
