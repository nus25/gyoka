# Creating a Feed

## Overview

This guide explains how to create a new feed in Gyoka.
The process has two steps:

1. Create a feed generator record in your PDS (Personal Data Server).
2. Register the feed in Gyoka Editor.

## Steps

### 1. Create Feed Generator Record in PDS

Create an `app.bsky.feed.generator` record in your PDS.

#### Option 1: Using the official feed generator script (recommended)

Use the [official feed generator starter kit](https://github.com/bluesky-social/feed-generator).
Then use the [publishing script](https://github.com/bluesky-social/feed-generator?tab=readme-ov-file#publishing-your-feed).

Set your Gyoka Generator endpoint as `FEEDGEN_SERVICE_DID`.
Example: `did:web:gyoka-generator.{your-subdomain}.workers.dev`.
You can also use your custom domain.

#### Option 2: Direct PDS record creation

Create the record with the AT Protocol PDS repository API
[xrpc/com.atproto.repo.createRecord](https://docs.bsky.app/docs/api/com-atproto-repo-create-record).

See also the
[app.bsky.feed.generator lexicon](https://github.com/bluesky-social/atproto/blob/main/lexicons/app/bsky/feed/generator.json).

After you create the record, the feed URI has this format:
`at://{did}/app.bsky.feed.generator/{record-key}`

### 2. Register the Feed in Gyoka Editor

After you create the record, register the feed with the `registerFeed` API.

```bash
curl -X POST https://your-gyoka-editor.workers.dev/api/feed/registerFeed \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "uri": "at://did:plc:your-did/app.bsky.feed.generator/your-feed",
    "langFilter": false,
    "isActive": true
  }'
```

Parameters:

- `uri`: Feed URI from step 1 (required)
- `langFilter`: Enable language filtering (optional, default: `true`)
  Gyoka filters by primary language tags in the request.
  It reads up to the first 5 languages (for example, `ja`, `en`).
  See [Language Handling documentation](https://docs.bsky.app/docs/starter-templates/custom-feeds#language-handling).
- `isActive`: Feed active status (optional, default: `true`)
  If `false`, Gyoka Generator does not return feed data.

Response:

```json
{
  "message": "Feed registered successfully",
  "feed": {
    "uri": "at://did:plc:your-did/app.bsky.feed.generator/your-feed",
    "langFilter": false,
    "isActive": true
  }
}
```

> [!NOTE]
>
> - `X-API-Key` is required for Gyoka Editor authentication.
> - Each feed URI must be unique in Gyoka.
> - Duplicate feed registration returns `409 Conflict`.
