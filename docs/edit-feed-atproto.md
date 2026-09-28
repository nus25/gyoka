# Feed Editing Guide (AT Protocol, Beta)

## Overview

Gyoka Editor AT Protocol lets you edit feed content with these operations:

- Add a post to one feed (`net.nusno.gyoka.feed.addPost`)
- Add multiple posts to multiple feeds in one request (`net.nusno.gyoka.feed.batchAddPosts`)
- List and filter posts in a feed (`net.nusno.gyoka.feed.getPosts`)
- Remove a post from one feed (`net.nusno.gyoka.feed.removePost`)
- Remove multiple posts from multiple feeds in one request (`net.nusno.gyoka.feed.batchRemovePosts`)
- Remove posts by one author from one feed (`net.nusno.gyoka.feed.removePostByAuthor`)
- Trim a feed to keep a fixed number of posts (`net.nusno.gyoka.feed.trimFeed`)
- Trim a feed to keep posts indexed at or after a timestamp (`net.nusno.gyoka.feed.trimFeedBefore`)

Use XRPC endpoint paths in this format:
`/xrpc/{nsid}`

Example:
`/xrpc/net.nusno.gyoka.feed.addPost`

## Gyoka Lexicon

Gyoka Editor AT Protocol uses Lexicon files defined in this project.
These files define NSIDs, request schemas, response schemas, and error names.

Main location:

- `gyoka/packages/editor-atproto/lexicons`

## Authentication

Requests must use AT Protocol XRPC authentication.
Use one of these methods:

- Service Proxying
- Inter-Service Authentication (JWT)

For details, see the XRPC authentication specification:
https://atproto.com/specs/xrpc

If `GYOKA_EDITOR_AUTH_REQUIRED` is enabled, requests without valid authentication fail.
If the JWT issuer DID is not in `GYOKA_EDITOR_ADMIN_DIDS`, the server returns `Forbidden`.

Note: All AT URIs in requests must use DID-based authority.
Gyoka does not accept handle-based authority.

## Adding a Post (addPost)

Use `net.nusno.gyoka.feed.addPost` to add a post to a feed.

### Request Example

```http
POST /xrpc/net.nusno.gyoka.feed.addPost
Authorization: Bearer <service-jwt>
Content-Type: application/json
```

```json
{
  "feed": "at://did:plc:youruser/app.bsky.feed.generator/your-feed",
  "post": {
    "uri": "at://did:plc:authoruser/app.bsky.feed.post/example-post",
    "cid": "bafyreiabc123example456cid789xyz",
    "languages": ["en", "ja"],
    "indexedAt": "2024-01-15T12:00:00Z",
    "reason": {
      "$type": "app.bsky.feed.defs#skeletonReasonRepost",
      "repost": "at://did:plc:reposter/app.bsky.feed.repost/repost-id"
    }
  }
}
```

### Parameter Description

- `feed`: Feed URI (required)
- `post`: Post object to add
  - `uri`: Post URI (required)
  - `cid`: Post CID (required)
  - `languages`: Array of language codes (optional)
    Use this field when feed `langFilter` is `true`.
    If this field is missing or empty, Gyoka stores `"*"` (all languages).
    Gyoka normalizes input to primary tags.
    Example: `"en-US"` -> `"en"`, `"JA-JP"` -> `"ja"`.
    If `"*"` and specific tags are mixed, `"*"` has priority.
  - `indexedAt`: Post index time (optional)
    Gyoka sorts feed posts by this value in descending order.
    If this field is missing, Gyoka uses current time.
  - `feedContext`: Optional context string for response clients (`max 2000` chars)
    This value is passed through to clients.
  - `reason`: Optional reason object
    - `app.bsky.feed.defs#skeletonReasonRepost`: requires `repost`
    - `app.bsky.feed.defs#skeletonReasonPin`: requires no additional fields

### Response Example

```json
{
  "message": "Post added successfully",
  "feed": "at://did:plc:youruser/app.bsky.feed.generator/your-feed",
  "post": {
    "uri": "at://did:plc:authoruser/app.bsky.feed.post/example-post",
    "cid": "bafyreiabc123example456cid789xyz",
    "languages": ["en", "ja"],
    "indexedAt": "2024-01-15T12:00:00Z",
    "reason": {
      "$type": "app.bsky.feed.defs#skeletonReasonRepost",
      "repost": "at://did:plc:reposter/app.bsky.feed.repost/repost-id"
    }
  }
}
```

## Adding Multiple Posts to Multiple Feeds (batchAddPosts)

Use `net.nusno.gyoka.feed.batchAddPosts` to add multiple posts to multiple feeds in one request.

This endpoint lets you send multiple feed and post combinations, with a default maximum of 25 posts per request.

### Request Example

```http
POST /xrpc/net.nusno.gyoka.feed.batchAddPosts
Authorization: Bearer <service-jwt>
Content-Type: application/json
```

```json
{
  "entries": [
    {
      "feed": "at://did:plc:user1/app.bsky.feed.generator/feed1",
      "posts": [
        {
          "uri": "at://did:plc:author1/app.bsky.feed.post/post-1",
          "cid": "bafyreiabc123example456cid789xyz",
          "languages": ["en"],
          "indexedAt": "2024-01-15T12:00:00Z"
        }
      ]
    },
    {
      "feed": "at://did:plc:user2/app.bsky.feed.generator/feed2",
      "posts": [
        {
          "uri": "at://did:plc:author2/app.bsky.feed.post/post-2",
          "cid": "bafyreibcd456example789cid012xyz",
          "languages": ["ja"],
          "indexedAt": "2024-01-15T13:00:00Z"
        },
        {
          "uri": "at://did:plc:author2/app.bsky.feed.post/post-3",
          "cid": "bafyreibcd456example789cid012xyz",
          "languages": ["ja"],
          "indexedAt": "2024-01-15T14:00:00Z"
        }
      ]
    }
  ]
}
```

### Parameter Description

- `entries`: Array of feed entries to add
  - `feed`: Feed URI (required)
  - `posts`: Array of post objects (required, minimum 1)
    - `uri`: Post URI (required)
    - `cid`: Post CID (required)
    - `languages`: Array of language codes (optional)
    - `indexedAt`: Post index time (optional, default: current time)
    - `feedContext`: Optional context string (`max 2000` chars)
    - `reason`: Optional reason object (`skeletonReasonRepost` with required `repost`, or `skeletonReasonPin`)

### Response Example

```json
{
  "results": [
    {
      "feed": "at://did:plc:user1/app.bsky.feed.generator/feed1",
      "results": [
        {
          "uri": "at://did:plc:author1/app.bsky.feed.post/post-1",
          "status": "added"
        }
      ]
    },
    {
      "feed": "at://did:plc:user2/app.bsky.feed.generator/feed2",
      "results": [
        {
          "uri": "at://did:plc:author2/app.bsky.feed.post/post-2",
          "status": "added"
        },
        {
          "uri": "at://did:plc:author2/app.bsky.feed.post/post-3",
          "status": "added"
        }
      ]
    }
  ]
}
```

- Each `feed` in the response contains a `results` array.
- If a post fails, its `status` is `"error"` and response has `error`.

> [!NOTE]
>
> - If the total number of posts in `entries` exceeds the limit, request returns `400 BadRequest`.
> - Default limit is 25.
> - You can change the limit with environment variable `MAX_BATCH_POSTS`.
> - Posts are added in the order in each feed entry.
> - This operation is not atomic.
>   A successful post is added even if another post fails.

## Getting Posts (getPosts)

Use `net.nusno.gyoka.feed.getPosts` to list posts in a feed. You can filter by
post URI, CID, and indexed timestamp. When multiple filters are specified, a post
must match all of them.

### Request Example

```http
GET /xrpc/net.nusno.gyoka.feed.getPosts?feed=at%3A%2F%2Fdid%3Aplc%3Ayouruser%2Fapp.bsky.feed.generator%2Fyour-feed&uri=at%3A%2F%2Fdid%3Aplc%3Aauthoruser%2Fapp.bsky.feed.post%2Fexample-post&limit=100
Authorization: Bearer <service-jwt>
```

### Query Parameters

- `feed`: Feed URI. Required for the first request when `cursor` is omitted.
- `uri`: Optional post URI filter.
- `cid`: Optional post CID filter.
- `indexedAt`: Optional indexed timestamp filter. The value is normalized to an
  ISO 8601 UTC timestamp before it is compared.
- `limit`: Maximum number of posts to return. Optional; defaults to `1000` and
  accepts values from `1` through `3000`.
- `cursor`: Opaque cursor returned from a previous request. It retains the feed,
  filters, and pagination position.

### Response Example

```json
{
  "feed": "at://did:plc:youruser/app.bsky.feed.generator/your-feed",
  "posts": [
    {
      "uri": "at://did:plc:authoruser/app.bsky.feed.post/example-post",
      "cid": "bafyreiabc123example456cid789xyz",
      "languages": ["en", "ja"],
      "indexedAt": "2024-01-15T12:00:00.000Z"
    }
  ],
  "cursor": "<opaque-cursor>"
}
```

When `cursor` is present, request the next page with the cursor alone:

```http
GET /xrpc/net.nusno.gyoka.feed.getPosts?cursor=<opaque-cursor>
Authorization: Bearer <service-jwt>
```

You may include `feed`, `uri`, `cid`, or `indexedAt` with a cursor only when each
provided value matches the conditions stored in that cursor. A mismatch returns
`400 BadRequest`. `limit` may be changed between pages. Omit `cursor` from the
response when there is no next page.

## Removing a Post (removePost)

Use `net.nusno.gyoka.feed.removePost` to remove a post from a feed.

### Request Example

```http
POST /xrpc/net.nusno.gyoka.feed.removePost
Authorization: Bearer <service-jwt>
Content-Type: application/json
```

```json
{
  "feed": "at://did:plc:youruser/app.bsky.feed.generator/your-feed",
  "post": {
    "uri": "at://did:plc:authoruser/app.bsky.feed.post/example-post",
    "indexedAt": "2024-01-15T12:00:00Z"
  }
}
```

### Parameter Description

- `feed`: Feed URI (required)
- `post`: Post object to remove
  - `uri`: Post URI (required)
  - `indexedAt`: Post index time (optional)
    Use this field to remove a specific indexed post.

### Response Example

```json
{
  "message": "Post removed successfully",
  "feed": "at://did:plc:youruser/app.bsky.feed.generator/your-feed",
  "post": {
    "uri": "at://did:plc:authoruser/app.bsky.feed.post/example-post",
    "indexedAt": "2024-01-15T12:00:00Z"
  }
}
```

## Removing Multiple Posts from Multiple Feeds (batchRemovePosts)

Use `net.nusno.gyoka.feed.batchRemovePosts` to remove multiple posts from multiple feeds in one request.

### Request Example

```http
POST /xrpc/net.nusno.gyoka.feed.batchRemovePosts
Authorization: Bearer <service-jwt>
Content-Type: application/json
```

```json
{
  "entries": [
    {
      "feed": "at://did:plc:user1/app.bsky.feed.generator/feed1",
      "posts": [
        {
          "uri": "at://did:plc:author1/app.bsky.feed.post/post-1",
          "indexedAt": "2024-01-15T12:00:00Z"
        }
      ]
    },
    {
      "feed": "at://did:plc:user2/app.bsky.feed.generator/feed2",
      "posts": [
        {
          "uri": "at://did:plc:author2/app.bsky.feed.post/post-2",
          "indexedAt": "2024-01-15T13:00:00Z"
        },
        {
          "uri": "at://did:plc:author2/app.bsky.feed.post/post-3"
        }
      ]
    }
  ]
}
```

### Parameter Description

- `entries`: Array of feed entries to remove
  - `feed`: Feed URI (required)
  - `posts`: Array of post objects (required, minimum 1)
    - `uri`: Post URI (required)
    - `indexedAt`: Post index time (optional)
      Use this field to remove a specific indexed post.

### Response Example

```json
{
  "results": [
    {
      "feed": "at://did:plc:user1/app.bsky.feed.generator/feed1",
      "results": [
        {
          "uri": "at://did:plc:author1/app.bsky.feed.post/post-1",
          "status": "removed"
        }
      ]
    },
    {
      "feed": "at://did:plc:user2/app.bsky.feed.generator/feed2",
      "results": [
        {
          "uri": "at://did:plc:author2/app.bsky.feed.post/post-2",
          "status": "removed"
        },
        {
          "uri": "at://did:plc:author2/app.bsky.feed.post/post-3",
          "status": "removed"
        }
      ]
    }
  ]
}
```

- Each `feed` in the response contains a `results` array.
- If a post fails, its `status` is `"error"` and response has `error`.

> [!NOTE]
>
> - If the total number of posts in `entries` exceeds the limit, request returns `400 BadRequest`.
> - Default limit is 25.
> - You can change the limit with environment variable `MAX_BATCH_POSTS`.
> - Posts are removed in the order in each feed entry.
> - This operation is not atomic.
>   A successful post is removed even if another post fails.

## Removing Posts by Author (removePostByAuthor)

Use `net.nusno.gyoka.feed.removePostByAuthor` to remove all posts by one author from a feed.

### Request Example

```http
POST /xrpc/net.nusno.gyoka.feed.removePostByAuthor
Authorization: Bearer <service-jwt>
Content-Type: application/json
```

```json
{
  "feed": "at://did:plc:youruser/app.bsky.feed.generator/your-feed",
  "author": "did:plc:authoruser"
}
```

### Parameter Description

- `feed`: Feed URI (required)
- `author`: Author DID to remove (required)

### Response Example

```json
{
  "message": "Posts by author removed successfully",
  "feed": "at://did:plc:youruser/app.bsky.feed.generator/your-feed",
  "author": "did:plc:authoruser",
  "deletedCount": 3
}
```

## Trimming a Feed (trimFeed)

Use `net.nusno.gyoka.feed.trimFeed` to limit post count in a feed.
This endpoint keeps the specified number of latest posts and removes older ones.

### Request Example

```http
POST /xrpc/net.nusno.gyoka.feed.trimFeed
Authorization: Bearer <service-jwt>
Content-Type: application/json
```

```json
{
  "feed": "at://did:plc:youruser/app.bsky.feed.generator/your-feed",
  "remain": 100
}
```

### Parameter Description

- `feed`: Feed URI (required)
- `remain`: Number of posts to keep (required, integer >= 0)

### Response Example

```json
{
  "message": "Feed trimmed successfully",
  "feed": "at://did:plc:youruser/app.bsky.feed.generator/your-feed",
  "deletedCount": 25
}
```

## Trimming a Feed Before a Timestamp (trimFeedBefore)

Use `net.nusno.gyoka.feed.trimFeedBefore` to remove posts indexed before a timestamp.
Posts indexed at or after the timestamp remain in the feed.

### Request Example

```http
POST /xrpc/net.nusno.gyoka.feed.trimFeedBefore
Authorization: Bearer <service-jwt>
Content-Type: application/json
```

```json
{
  "feed": "at://did:plc:youruser/app.bsky.feed.generator/your-feed",
  "before": "2025-01-01T00:00:00.000Z"
}
```

### Parameter Description

- `feed`: Feed URI (required)
- `before`: Exclusive timestamp boundary (required, datetime)

### Response Example

```json
{
  "message": "Posts before timestamp trimmed successfully",
  "feed": "at://did:plc:youruser/app.bsky.feed.generator/your-feed",
  "before": "2025-01-01T00:00:00.000Z",
  "deletedCount": 25
}
```

## Error Handling

Endpoints can return these errors:

- `AuthenticationRequired`: Missing or invalid authentication credentials
- `Forbidden`: Authenticated caller DID is not allowed
- `BadRequest`: Invalid request payload
- `UnknownFeed`: Target feed URI is not registered
- `NotFound`: Feed or post was not found (`removePost`)
- `InternalServerError`: Server-side failure

For `batchAddPosts` and `batchRemovePosts`, per-item errors are in `results` with HTTP `200` (partial success model).
These errors are not top-level `404` errors.

Error response example:

```json
{
  "error": "UnknownFeed",
  "message": "Feed with URI at://did:plc:nonexistent/app.bsky.feed.generator/feed does not exist."
}
```

## Developer Mode

For debugging, set environment variable `DEVELOPER_MODE` to `enabled`.
Then you can see detailed logs.
