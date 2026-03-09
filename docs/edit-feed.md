# Feed Editing Guide

## Overview

The Gyoka-editor allows you to edit feed content using the following operations:

- Add a post to a specified feed (`/api/feed/addPost`)
- Add multiple posts to multiple feeds in a single request (`/api/feed/batchAddPosts`)
- Remove a post from a specified feed (`/api/feed/removePost`)
- Remove multiple posts from multiple feeds in a single request (`/api/feed/batchRemovePosts`)
- Remove posts from a specified feed by a specified author (`/api/feed/removePostByAuthor`)
- Trim the feed to keep a specified number of posts (`/api/feed/trimPosts`)

These APIs can be tested through the Swagger UI at `/docs` endpoint.
This document explains how to use each operation.

Note: All AT URIs in requests must have a DID-based authority. Gyoka does not accept a handle-based authority.

## Adding a Post (addPost)

To add a new post to the feed, use the `/api/feed/addPost` endpoint.

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

- `feed`: The URI of the feed (required)
- `post`: Information about the post to be added
  - `uri`: The URI of the post (required)
  - `cid`: The CID of the post (required)
  - `languages`: Array of language codes. Used for language filtering when feed `langFilter` is `true` (optional).
    - If omitted or empty, Gyoka stores `"*"`(all languages).
    - Input is normalized to primary tags (e.g. `"en-US"` -> `"en"`, `"JA-JP"` -> `"ja"`).
    - `"*"` takes precedence when mixed with specific language tags.
  - `indexedAt`: The timestamp when the post was indexed. Gyoka sorts feed posts in descending order by this timestamp (optional, defaults to the current time if not specified)
  - `feedContext`: Optional context string passed through to response clients (`max 2000` chars). See [Bluesky API documentation](https://docs.bsky.app/docs/api/app-bsky-feed-get-feed-skeleton#responses). This is for feed interactions, this is not used in gyoka at this time.
  - `reason`: Optional reason object.
    - `app.bsky.feed.defs#skeletonReasonRepost`: requires `repost`
    - `app.bsky.feed.defs#skeletonReasonPin`: no additional fields required

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

## Adding multiple posts to multiple feeds (batchAddPosts)

To add multiple posts to multiple feeds in a single request, use the `/api/feed/batchAddPosts` endpoint.

This endpoint allows you to specify several feed and post combinations at once.  
up to a total of 25 posts across all feeds in a single request.

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

- `entries`: Array of objects, each specifying a feed and the posts to add.
  - `feed`: The URI of the feed (required)
  - `posts`: Array of post objects to add (required, at least 1)
    - `uri`: The URI of the post (required)
    - `cid`: The CID of the post (required)
    - `languages`: Array of language codes (optional)
    - `indexedAt`: The timestamp when the post was indexed (optional, defaults to current time if not specified)
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

### Notes

- If the total number of posts in `entries` exceeds 25, the request will be rejected with a `400 BadRequest` error.
  By default, the maximum number of posts is 25, but you can change this limit by setting the environment variable `MAX_BATCH_POSTS`.  
  If you change this limit, please make sure to check the restrictions of Cloudflare workers.
- Posts are added to each feed in the order provided.
- Error handling and validation are the same as for single-feed operations.
- **Partial Success:**  
  When using `batchAddPosts`, if some posts fail to be added (for example, due to invalid data), the response will indicate `"status": "error"` for those posts, along with an `error` field describing the reason. Posts that can be added successfully will have `"status": "added"`.  
  The operation is not atomic: posts that succeed will be added even if others fail in the same request. Please check the `results` array in the response to confirm which posts were added and which failed.

## Removing a Post (removePost)

To remove a post from the feed, use the `/api/feed/removePost` endpoint.

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

- `feed`: The URI of the feed (required)
- `post`: Information about the post to be removed
  - `uri`: The URI of the post (required)
  - `indexedAt`: The indexing time of the post (optional, used to remove a specific indexed post)

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

If `indexedAt` is passed in the request, it is also included in `post` in the response.

## Removing multiple posts from multiple feeds (batchRemovePosts)

To remove multiple posts from multiple feeds in a single request, use the `/api/feed/batchRemovePosts` endpoint.

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

- `entries`: Array of objects, each specifying a feed and the posts to remove.
  - `feed`: The URI of the feed (required)
  - `posts`: Array of post objects to remove (required, at least 1)
    - `uri`: The URI of the post (required)
    - `indexedAt`: The timestamp when the post was indexed (optional, used to remove a specific indexed post)

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

### Notes

- If the total number of posts in `entries` exceeds 25, the request will be rejected with a `400 BadRequest` error.
  By default, the maximum number of posts is 25, but you can change this limit by setting the environment variable `MAX_BATCH_POSTS`.  
  If you change this limit, please make sure to check the restrictions of Cloudflare workers.
- Posts are removed from each feed in the order provided.
- Error handling and validation are the same as for single-feed operations.
- **Partial Success:**  
  When using `batchRemovePosts`, if some posts fail to be removed (for example, due to the post not existing), the response will indicate `"status": "error"` for those posts, along with an `error` field describing the reason. Posts that can be removed successfully will have `"status": "removed"`.  
  The operation is not atomic: posts that succeed will be removed even if others fail in the same request. Please check the `results` array in the response to confirm which posts were removed and which failed.

## Removing a Post by Author (removePostByAuthor)

To remove all posts by a specific author from the feed, use the `/api/feed/removePostByAuthor` endpoint.

### Request Example

```json
{
  "feed": "at://did:plc:youruser/app.bsky.feed.generator/your-feed",
  "author": "did:plc:authoruser"
}
```

### Parameter Description

- `feed`: The URI of the feed (required)
- `author`: The DID of the author whose posts should be removed (required)

### Response Example

```json
{
  "message": "Posts by author removed successfully",
  "feed": "at://did:plc:youruser/app.bsky.feed.generator/your-feed",
  "author": "did:plc:authoruser",
  "deletedCount": 3
}
```

This operation removes all posts in the specified feed that were authored by the given DID. Use with caution, as it may affect multiple posts at once.

## Trimming the Feed (trimFeed)

To limit the number of posts in the feed, use the `/api/feed/trimPosts` endpoint. This endpoint keeps the specified number of latest posts and removes older ones.

### Request Example

```json
{
  "feed": "at://did:plc:youruser/app.bsky.feed.generator/your-feed",
  "remain": 100
}
```

### Parameter Description

- `feed`: The URI of the feed (required)
- `remain`: Number of posts to keep (required, integer greater than or equal to 0)

### Response Example

```json
{
  "message": "Posts trimed successfully",
  "feed": "at://did:plc:youruser/app.bsky.feed.generator/your-feed",
  "deletedCount": 25
}
```

### Note

The trim operation may cause a large number of database read and write operations. Please carefully consider the frequency of using this operation to avoid excessive database load.

## Error Handling

All endpoints may return the following errors:

- `400 BadRequest`: Invalid request parameters
- `404 UnknownFeed`: The specified feed does not exist (e.g. `addPost`, `removePostByAuthor`, `trimPosts`)
- `404 NotFound`: For `removePost` when the feed or post does not exist
- `500 InternalServerError`: Server-side issues such as database query failures

For `batchAddPosts` / `batchRemovePosts`, missing feed or missing post errors are returned per item in the `results` payload with HTTP `200` (partial success model), not as top-level `404`.

Error Response Example:

```json
{
  "error": "UnknownFeed",
  "message": "Feed with URI at://did:plc:nonexistent/app.bsky.feed.generator/feed does not exist."
}
```

## Developer Mode

For debugging purposes, set the environment variable `DEVELOPER_MODE` to `enabled` to view detailed log information. This is useful during testing or troubleshooting.
