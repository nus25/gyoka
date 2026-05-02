# Gyoka

Gyoka is a edge server for Bluesky custom feed generators, running on Cloudflare Workers with D1 database.
It serves feed skeletons to Bluesky/AppView and provides an API to manage the post list for each feed.

To populate feeds, you need a separate post-collection component that discovers relevant posts
via Firehose, Jetstream, or other means, and registers or removes them through the editor API.

- `gyoka-generator`: public feed skeleton endpoint for Bluesky/AppView
- `gyoka-editor`: private API for managing feeds and posts

## Why Gyoka?

- **Edge-native**: Runs on Cloudflare Workers worldwide — low latency response to Bluesky/AppView requests.
- **Decoupled by design**: Post collection is fully separated from feed serving.
  AppView sees only the generator endpoint; collectors and their logic are hidden
  behind the private editor API.
- **Multiple feeds, single deployment**: Manage any number of feeds from one worker instance.
- **AT Protocol ready**: DID document of feed generator, feed skeleton pagination, and Service JWT
  verification are supported.
- **Rich management API**: Batch add/remove, per-author removal, feed trimming,
  and active/inactive toggling via the editor REST API.

## Features

Gyoka supports:

- Feed generator endpoints
  - `/xrpc/app.bsky.feed.getFeedSkeleton`
  - `/xrpc/app.bsky.feed.describeFeedGenerator`
  - `/.well-known/did.json`
  - `/doc` (for terms of service and privacy policy documents)
- Language tag filtering on `/xrpc/app.bsky.feed.getFeedSkeleton` via request headers
- JWT verification on `/xrpc/app.bsky.feed.getFeedSkeleton` with cached DID document resolution

Gyoka does **not** support in this version:

- Feed interactions
  (`acceptsInteractions` in `app.bsky.feed.generator` record must be `false`)
- Feed management via XRPC endpoints (the editor worker exposes an OpenAPI endpoints instead)

## Repository structure

- `packages/generator`: [generator guide](packages/generator/README.md)
- `packages/editor`: [editor guide](packages/editor/README.md)
- `packages/shared`: shared library and migrations
- `docs/create-feed.md`: [how to create feed records](docs/create-feed.md)
- `docs/edit-feed.md`: [how to edit feed data](docs/edit-feed.md)

## Requirements

- Node.js v22 or later
- pnpm v10 or later
- Wrangler v4
- Cloudflare account

## Quick start (deploy to production)

1. Clone this repository and install dependencies.

   ```sh
   pnpm install
   ```

2. Create D1 database and keep the returned `database_id`.

   ```sh
   pnpm d1-create

   # or with location
   pnpm d1-create --location wnam
   ```

   Add the `--location` option to create the D1 database in a specific location. See [wrangler D1 create](https://developers.cloudflare.com/workers/wrangler/commands/#d1-create) document.

3. Configure production settings.
   - Set production `database_id` in:
     - `packages/editor/wrangler.jsonc`
     - `packages/generator/wrangler.jsonc`
   - Configure worker vars (details in each package README):
     - generator vars: see [packages/generator/README.md](packages/generator/README.md)
     - editor vars: see [packages/editor/README.md](packages/editor/README.md)

4. Initialize production schema.

   ```sh
   pnpm d1-init:production
   ```

5. Deploy both workers.

   ```sh
   pnpm editor run deploy
   pnpm generator run deploy
   ```

6. Set editor API key secret for production.

   ```sh
   pnpm editor gyoka-api-key:put
   ```

   > [!NOTE]
   >
   > `X-API-Key` provides minimal authentication only. For production use, combining with an additional authentication layer such as [Cloudflare One](https://developers.cloudflare.com/cloudflare-one/) is strongly recommended.

7. Create and manage feeds.
   - How to create feeds: [docs/create-feed.md](docs/create-feed.md)
   - How to edit feeds: [docs/edit-feed.md](docs/edit-feed.md)

## Local development

1. Initialize local D1 and optional sample data.

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
   - generator DID document: `http://localhost:8788/.well-known/did.json`
   - editor OpenAPI docs (dev): `http://localhost:8787/docs`
     - Default API key is `dev` set in `.dev.vars`

## Test

- Workspace all tests: `pnpm test:all`
- Package-specific examples:
  - `pnpm generator test run`
  - `pnpm editor test run`
  - `pnpm shared test run`

## License

MIT License

## Author

[Nus](https://bsky.app/profile/nus.bsky.social)
