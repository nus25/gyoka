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
  - `enabled`: require service JWT for generator XRPC endpoints
  - `disabled`: skip JWT verification
- `DID_CACHE_TTL_SECONDS`
  - DID resolver cache TTL in seconds
  - default: `2592000` (30 days)
  - invalid values (non-numeric, 0, negative) fallback to default
- `DEVELOPER_MODE`
  - `enabled`: include stack traces in logs/responses where applicable
  - `disabled`: production-safe logging

## DID resolver cache behavior

- Cache key: resolver request URL + `accept: application/did+json`
- Fresh cache hit: return cached DID doc and start background ETag revalidation
- Stale/miss: fetch from origin, cache `200` responses
- Request with `cache: no-cache`: bypass cache read and fetch origin directly

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

   - Set `routes`/`workers_dev` for your domain
   - Set production `vars`
   - Set production `d1_databases[0].database_id`

2. Deploy from repository root.

```sh
pnpm generator run deploy
```

## Related docs

- root onboarding: [../../README.md](../../README.md)
- feed creation flow: [../../docs/create-feed.md](../../docs/create-feed.md)
- editor API counterpart: [../editor/README.md](../editor/README.md)
