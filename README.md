# Gyoka

- Gyoka is simple stock-post-style feed generator for Bluesky which works on Cloudflare workers.
- Gyoka is composed of two workers(gyoka-editor and gyoka-generator) and shared D1 SQL database.
- The generator is public endpoint for feed requests from Bluesky services.
- The editor is private endpoint with feed edit APIs. You need a client tool to edit posts in feed like [Yuge](https://github.com/nus25/yuge).

# Requirements
- Node.js v23
- Wrangler v4
- Your own Cloudflare account

# Setup
1. Clone repository and install packages.

    ```sh
    npm install
    ```

2. Create new D1 database and copy the `database_id`.

    ```sh
    npm run d1-create
    ```

3. Add the `database_id` to the production environment settings in both `packages/editor/wrangler.jsonc` and `packages/generator/wrangler.jsonc`. Also update the `vars` and other configuration settings as needed.

    ```json
    "env": {
		"production": {
			"vars": {
				"FEEDGEN_PUBLISHER_DID": "did:plc:publisher",
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

4. Initialize database.

    ```sh
    npm run d1-init-local -w packages/generator
    npm run d1-init-production -w packages/generator
    ```

5. Run at local.

    ```sh
    npm run editor-dev
    npm run generator-dev
    ```

6. Access documents.

    If local-dev port is 8787, you can see documents below.
    - Redocs: localhost:8787/redocs
    - Swagger UI: localhost:8787/docs

# Deploy
Deploy editor and generator workers to Cloudflare workers.

```sh
npm run deploy -w packages/editor
npm run deploy -w packages/generator
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
npx wrangler secret put GYOKA_API_KEY --env production
```

## License

MIT License

## Auther

[Nus](https://bsky.app/profile/nus.bsky.social)