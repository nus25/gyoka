# Gyoka

Gyoka is a stock-post-style feed generator for Bluesky on Cloudflare Workers.

- `gyoka-generator`: public feed endpoint for Bluesky/AppView
- `gyoka-editor`: private API for feed/post management
- `shared`: common validators, types, constants, migrations

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

1. Install dependencies.

   ```sh
   pnpm install
   ```

2. Create D1 database and keep the returned `database_id`.

   ```sh
   pnpm d1-create
   ```

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

5. Set editor API key secret for production.

   ```sh
   pnpm --dir packages/editor wrangler secret put GYOKA_API_KEY --env production
   ```

6. Deploy both workers.

   ```sh
   pnpm editor run deploy
   pnpm generator run deploy
   ```

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

   - generator DID document: `http://localhost:8787/.well-known/did.json`
   - editor OpenAPI docs (dev): `http://localhost:8787/docs`

## Test

- Workspace all tests: `pnpm test run`
- Root alias for all tests: `pnpm test:all`
- Package-specific examples:
  - `pnpm generator test run`
  - `pnpm editor test run`
  - `pnpm shared test run`

## License

MIT License

## Author

[Nus](https://bsky.app/profile/nus.bsky.social)
