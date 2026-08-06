# Gyoka

Gyoka is an edge service for Bluesky custom feed generators.
It runs on Cloudflare Workers with a D1 database, serves feed skeletons to Bluesky AppView, and provides APIs to manage posts for each feed.

To populate feeds, run a separate post-collection component.
That collector can discover posts from Firehose, Jetstream, or other sources, then add or remove them through the editor API.

- `gyoka-generator`: Public feed skeleton endpoint for Bluesky AppView.
- `gyoka-editor`: Private API to manage feeds and posts (OpenAPI-based).
- `gyoka-editor-atproto`: `gyoka-editor` API based on AT Protocol Lexicon (beta).

## Why Gyoka?

- **Edge-native**: Runs globally on Cloudflare Workers, so Bluesky/AppView requests can be served with low latency.
- **Decoupled architecture**: Feed serving and post collection are independent.
  AppView calls only the generator endpoint, while collector logic stays behind the private editor API.
- **Multi-feed operation**: You can manage many feeds from one deployment.
- **AT Protocol support**: Includes feed generator DID document endpoints, feed skeleton pagination, and Service JWT verification.
- **Practical management API**: Supports batch add/remove, remove-by-author, feed trimming, and active/inactive control.

## Features

Gyoka includes the following features:

- Feed generator endpoints:
  - `/xrpc/app.bsky.feed.getFeedSkeleton`
  - `/xrpc/app.bsky.feed.describeFeedGenerator`
  - `/.well-known/did.json`
  - `/doc` for Terms of Service and Privacy Policy documents
- Language tag filtering on `/xrpc/app.bsky.feed.getFeedSkeleton` by request headers
- JWT verification on `/xrpc/app.bsky.feed.getFeedSkeleton` with cached DID document resolution
- Feed management via XRPC endpoints through `editor-atproto`

Current limitations:

- Feed interactions
  (`acceptsInteractions` in `app.bsky.feed.generator` must be `false`)
- Per-user feeds
- Multi-user editing (one administrator manages all feeds)

## Repository Structure

- `packages/generator`: [Generator guide](packages/generator/README.md)
- `packages/editor`: [Editor guide](packages/editor/README.md)
- `packages/editor-atproto`: [Editor-atproto guide](packages/editor-atproto/README.md)
- `packages/shared`: Shared library and migrations
- `docs/create-feed.md`: [How to create feed records](docs/create-feed.md)
- `docs/edit-feed.md`: [How to edit feed data](docs/edit-feed.md)
- `docs/edit-feed-atproto.md`: [How to edit feed data with AT Protocol](docs/edit-feed-atproto.md)

## Requirements

- Node.js v22 or later
- pnpm v11 or later
- Wrangler v4
- Cloudflare account

## Quick Start (Production Deployment)

1. Clone this repository and install dependencies.

```sh
pnpm install
```

2. Create a D1 database and save the returned `database_id`.

```sh
pnpm d1-create

# Example: specify a location
pnpm d1-create --location wnam
```

Use `--location` to create the D1 database in a specific location.
See [wrangler D1 create](https://developers.cloudflare.com/workers/wrangler/commands/#d1-create).

3. Configure production settings.

- Set production `database_id` in:
  - `packages/editor/wrangler.jsonc`
  - `packages/generator/wrangler.jsonc`
- Configure worker vars (see each package README):
  - Generator vars: [packages/generator/README.md](packages/generator/README.md)
  - Editor vars: [packages/editor/README.md](packages/editor/README.md)

4. Initialize the production schema.

```sh
pnpm d1-init:production
```

5. Deploy both workers.

```sh
pnpm editor run deploy
pnpm generator run deploy
```

6. Set the production editor API key secret.

```sh
pnpm editor gyoka-api-key:put
```

> [!NOTE]
> `X-API-Key` provides only basic authentication.
> For production, use an additional authentication layer such as [Cloudflare One](https://developers.cloudflare.com/cloudflare-one/).

7. Create and manage feeds.

- Create feeds: [docs/create-feed.md](docs/create-feed.md)
- Edit feeds: [docs/edit-feed.md](docs/edit-feed.md)

## Local Development

1. Initialize local D1 and optionally add sample data.

```sh
pnpm d1-init:local
pnpm d1-add-sample:local
```

2. Start workers.

```sh
pnpm editor dev
pnpm generator dev
```

3. Open endpoints.

- Generator DID document: `http://localhost:8788/.well-known/did.json`
- Editor OpenAPI docs (dev): `http://localhost:8787/docs`
- Default API key in `.dev.vars`: `dev`

## Test

- Run all workspace tests: `pnpm test:all`
- Run package tests:
  - `pnpm generator test run`
  - `pnpm editor test run`
  - `pnpm shared test run`

## License

MIT License

## Author

[Nus](https://bsky.app/profile/nus.bsky.social)
