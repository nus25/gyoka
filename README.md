# Gyoka

- Gyoka is simple stock-post-style feed generator for Bluesky which works on Cloudflare workers.
- Gyoka is composed of two workers(gyoka-editor and gyoka-generator) and shared D1 SQL database.
- The generator is public endpoint for feed requests from Bluesky services.
- The editor is private endpoint with feed edit APIs. You need a client tool to edit posts in feed like [Yuge](https://github.com/nus25/yuge).

## Features
Gyoka supports:
- Response for `/xrpc/app.bsky.feed.getFeedSkeleton`
- Response for `/xrpc/app.bsky.feed.describeFeedGenerator`
- Response for `/.well-known/did.json`
- Language tag filtering via `/xrpc/app.bsky.feed.getFeedSkeleton` request header
- JWT authentication for generator XRPC endpoints is configurable via `FEEDGEN_AUTH_REQUIRED`.

Gyoka does **not** support:
- Setting the `acceptsInteractions` value in `app.bsky.feed.generator` record (it must be `false`)


# Requirements
- Node.js v22 or later
- pnpm v10 or later
- Wrangler v4
- Your own Cloudflare account

# Setup
1. Clone repository and install packages.

    ```sh
    pnpm install
    ```

2. Create new D1 database and copy the `database_id`.

    ```sh
    pnpm d1-create
    ```

3. Add the `database_id` to the `production` environment settings in both `packages/editor/wrangler.jsonc` and `packages/generator/wrangler.jsonc`. Also update the `vars` and other worker configuration settings as needed.

    ```json
    "env": {
		"production": {
			"vars": {
				"FEEDGEN_PUBLISHER_DID": "did:plc:publisher",
                "FEEDGEN_AUTH_REQUIRED": "enabled",
				"FEEDGEN_HOST": "feed-generator.example.com",
				"DEVELOPER_MODE": "disabled"
			},
			"d1_databases": [
				{
					"binding": "DB",
					"database_name": "gyoka-db",
					"database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
				}
			]
		}
    }
    ```

        - `FEEDGEN_PUBLISHER_DID` must be a valid DID string (e.g. `did:plc:...`)
        - `FEEDGEN_HOST` must be the deployed Worker host that AppView accesses (e.g. `feed-generator.example.com`)
        - `FEEDGEN_AUTH_REQUIRED`
            - `enabled`: requires service JWT for generator XRPC endpoints
            - `disabled`: skips JWT verification

4. Initialize database.
    
    Initialize remote D1 instance
    ```sh
    pnpm d1-init:production
    ```
    
5. (Optional) Configure build-time flags in `wrangler.jsonc`:

    ```json
    "define": {
        "__OPENAPI_DOCS_ENABLED__": "true"
    }
    ```
    
    - `__OPENAPI_DOCS_ENABLED__`: Set to `true` to enable OpenAPI docs (`/docs`, `/redocs`, `/openapi.json` routes) for local development. Set to `false` in production.


# Deploy
Deploy editor and generator workers to Cloudflare workers.

```sh
pnpm editor run deploy
pnpm generator run deploy
```

# Authentication
The Gyoka-editor API supports simple API key authentication when an API key is configured.
To protect the API endpoints, it is recommended to use it in combination with Cloudflare Zero Trust.
At the local enviroment, make `.dev.vars` file at `packages/editor` directory and set API key value

```plaintext:.dev.vars
GYOKA_API_KEY=some-api-key
```
For the deploy worker, use `wrangler secret put` at `packages/editor` directory.

```sh
pnpx wrangler secret put GYOKA_API_KEY --env production
```

# Run at local for development
Initialize and add sample data to the local D1 database for development purposes
1. Initialize and add sample data to local D1 for development
    ```sh
    pnpm d1-init:local
    pnpm d1-add-sample:local
    ```

2. Run at local.

    ```sh
    pnpm editor dev
    pnpm generator dev
    ```

3. Access endpoints.

    If generator's local-dev port is 8787, you can access examples below.
    - DID Document: localhost:8787/.well-known/did.json
    - Generator document endpoint: localhost:8787/doc/{type}

## License

MIT License

## Auther

[Nus](https://bsky.app/profile/nus.bsky.social)
