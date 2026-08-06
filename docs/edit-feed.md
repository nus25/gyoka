# Feed Editing Guide

## Overview

Gyoka Editor lets you edit feed content with these operations:

- Add a post to a specified feed (`/api/feed/addPost`)
- Add multiple posts to multiple feeds in a single request (`/api/feed/batchAddPosts`)
- Remove a post from a specified feed (`/api/feed/removePost`)
- Remove multiple posts from multiple feeds in a single request (`/api/feed/batchRemovePosts`)
- Remove posts from a specified feed by a specified author (`/api/feed/removePostByAuthor`)
- Trim the feed to keep a specified number of posts (`/api/feed/trimPosts`)

You can test these APIs in Swagger UI at `/docs`.
This document explains how to use each operation.

Note: All AT URIs in requests must use DID-based authority.
Gyoka does not accept handle-based authority.

## Adding a Post (addPost)

Use `/api/feed/addPost` to add a post to a feed.

### Request Example

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
    If this field is missing, it uses the current time.
  - `feedContext`: Optional context string for response clients (`max 2000` chars)
    See [Bluesky API documentation](https://docs.bsky.app/docs/api/app-bsky-feed-get-feed-skeleton#responses).
    This is for feed interactions.
    Gyoka does not use this field in this version.
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

Use `/api/feed/batchAddPosts` to add multiple posts to multiple feeds in one request.

This endpoint lets you send multiple feed and post combinations, with a maximum of 25 posts per request.

### Request Example

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

- Each `feed` in the response contains a `results` array, listing the status for each post.
- If a post fails to be added, its `status` will be `"error"` and an `error` field will be included.

> [!NOTE]
>
> - If the total number of posts in `entries` exceeds 25, the request will be rejected with a `400 BadRequest` error.
>   Default maximum is 25.
>   You can change this limit with environment variable `MAX_BATCH_POSTS`.
>   If you change this value, check Cloudflare Workers limits.
> - Posts are added to each feed in the order provided.
> - Error handling and validation are the same as for single-feed operations.
> - **Partial success:**
>   If some posts fail (for example, invalid data), those posts return `"status": "error"` with an `error` field.
>   Posts that succeed return `"status": "added"`.
>   This operation is not atomic, so successful posts are still added even if others fail.
>   Check `results` to confirm which posts succeeded and which failed.

## Removing a Post (removePost)

Use `/api/feed/removePost` to remove a post from a feed.

### Request Example

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
    "uri": "at://did:plc:authoruser/app.bsky.feed.post/example-post"
  }
}
```

If the request includes `indexedAt`, the response `post` also includes `indexedAt`.

## Removing Multiple Posts from Multiple Feeds (batchRemovePosts)

Use `/api/feed/batchRemovePosts` to remove multiple posts from multiple feeds in one request.

This endpoint allows you to specify several feed and post combinations at once, up to a total of 25 posts across all feeds in a single request.

### Request Example

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

- Each `feed` in the response contains a `results` array, listing the status for each post.
- If a post fails to be removed, its `status` will be `"error"` and an `error` field will be included.

> [!NOTE]
>
> - If the total number of posts in `entries` exceeds 25, the request will be rejected with a `400 BadRequest` error.
>   Default maximum is 25.
>   You can change this limit with environment variable `MAX_BATCH_POSTS`.
>   If you change this value, check Cloudflare Workers limits.
> - Posts are removed from each feed in the order provided.
> - Error handling and validation are the same as for single-feed operations.
> - **Partial success:**
>   If some posts fail (for example, post does not exist), those posts return `"status": "error"` with an `error` field.
>   Posts that succeed return `"status": "removed"`.
>   This operation is not atomic.
>   A successful post is removed even if another post fails.
>   Check `results` to see which posts succeeded and which failed.

## Removing a Post by Author (removePostByAuthor)

Use `/api/feed/removePostByAuthor` to remove all posts by one author from a feed.

### Request Example

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

This operation removes all posts in the feed by the specified DID.
Use it carefully because it can remove many posts.

## Trimming the Feed (trimFeed)

Use `/api/feed/trimPosts` to limit post count in a feed.
This endpoint keeps the specified number of latest posts and removes older ones.

### Request Example

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
  "message": "Posts trimmed successfully",
  "feed": "at://did:plc:youruser/app.bsky.feed.generator/your-feed",
  "deletedCount": 25
}
```

### Note

The trim operation can trigger many database reads and writes.
Do not run it too often, because frequent use can increase database load.

## Error Handling

All endpoints may return the following errors:

- `400 BadRequest`: Invalid request parameters
- `404 UnknownFeed`: The specified feed does not exist (e.g. `addPost`, `removePostByAuthor`, `trimPosts`)
- `404 NotFound`: For `removePost` when the feed or post does not exist
- `500 InternalServerError`: Server-side issues, for example database query failures

For `batchAddPosts` and `batchRemovePosts`, missing feed and missing post errors are per-item errors in `results` with HTTP `200` (partial success model).
These errors are not top-level `404` errors.

Error Response Example:

```json
{
  "error": "UnknownFeed",
  "message": "Feed with URI at://did:plc:nonexistent/app.bsky.feed.generator/feed does not exist."
}
```

## Developer Mode

For debugging, set environment variable `DEVELOPER_MODE` to `enabled`.
You can then view detailed logs for testing and troubleshooting.
