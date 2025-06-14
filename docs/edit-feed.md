# Feed Editing Guide

## Overview

The Gyoka-editor allows you to edit feed content using the following operations:

- Add a post to a specified feed (`/api/feed/addPost`)
- Remove a post from a specified feed (`/api/feed/removePost`)
- Trim the feed to keep a specified number of posts (`/api/feed/trimPosts`)

These APIs can be tested through the Swagger UI at `/docs` endpoint.
This document explains how to use each operation.

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
    - `languages`: Array of language codes.This is used for language filter in generator if `langFilter` of the feed is `true` (optional)
    - `indexedAt`: The timestamp when the post was indexed. Gyoka sorts feed posts in descending order by this timestamp (optional, defaults to the current time if not specified)
    - `feedContext`: This is defined a part of feed interactions API (See [Bluesky API documentation](https://docs.bsky.app/docs/api/app-bsky-feed-get-feed-skeleton#responses)). At this time, you don't need to set this value.
    - `reason`: When a post is a repost, you can specify the repost URI to display it as a repost in the feed (optional)

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
        "uri": "at://did:plc:authoruser/app.bsky.feed.post/example-post",
        "indexedAt": "2024-01-15T12:00:00Z"
    }
}
```

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
    "message": "Posts trimmed successfully",
    "feed": "at://did:plc:youruser/app.bsky.feed.generator/your-feed",
    "deletedCount": 25
}
```

### Note

The trim operation may cause a large number of database read and write operations. Please carefully consider the frequency of using this operation to avoid excessive database load.

## Error Handling

All endpoints may return the following errors:

- `400 BadRequest`: Invalid request parameters
- `404 UnknownFeed`: The specified feed does not exist
- `404 NotFound`: The specified post does not exist (for removePost)
- `500 InternalServerError`: Server-side issues such as database query failures

Error Response Example:

```json
{
    "error": "UnknownFeed",
    "message": "Feed with URI at://did:plc:nonexistent/app.bsky.feed.generator/feed does not exist."
}
```

## Developer Mode

For debugging purposes, set the environment variable `DEVELOPER_MODE` to `enabled` to view detailed log information. This is useful during testing or troubleshooting.
