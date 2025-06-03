# Creating a Feed

## Overview
This document explains how to create a new feed in Gyoka. The process involves two steps:
1. Creating a feed generator record in your PDS (Personal Data Server)
2. Registering the feed from Gyoka-editor

## Steps

### 1. Create Feed Generator Record in PDS
First, you need to create an `app.bsky.feed.generator` record in your PDS:


#### Option 1: Using the official feed generator script (recommended)
See [official feed generator starter kit repository](https://github.com/bluesky-social/feed-generator) and use [publishing script](https://github.com/bluesky-social/feed-generator?tab=readme-ov-file#publishing-your-feed)

Set your gyoka-generator endpoint hostname as  `FEEDGEN_SERVICE_DID` like `did:web:gyoka-generator.{your-subdomain}.workers.dev` or your custom domain.

#### Option 2: Direct PDS record creation
Create record by the atproto PDS repository management API [xrpc/com.atproto.repo.createRecord](https://docs.bsky.app/docs/api/com-atproto-repo-create-record)

See also [app.bsky.feed.generator lexicon](https://github.com/bluesky-social/atproto/blob/main/lexicons/app/bsky/feed/generator.json)

After creating record, the feed URI will be in the format:
`at://{did}/app.bsky.feed.generator/{record-key}`

### 2. Registering the feed from Gyoka-editor
After creating the record, register the feed in Gyoka using the RegisterFeed API:

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
- `uri`: The feed URI from step 1 (required)
- `langFilter`: Enable language filtering (optional, default: true). Gyoka filters posts by primary language tags in requests (up to first 5 languages, ex. jp, en). See [Language Handling documentation](https://docs.bsky.app/docs/starter-templates/custom-feeds#language-handling) for details.
- `isActive`: Controls the feed's active status. When set to `false`, Gyoka-generator will not return feed data (optional, defaults to `true`)

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

## Notes
- API key is required for Gyoka-editor authentication (If configured)
- Each feed URI must be unique in Gyoka
