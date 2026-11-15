# Editing Feed Posts

This guide shows how to add, find, reorder, and remove posts in a registered feed.
Register a feed first: [create-feed.md](create-feed.md).

All examples use [goat](https://github.com/bluesky-social/goat) and the `$GYOKA_EDITOR` variable.
Set them up first: [Prepare to call the Editor API](create-feed.md#1-1-prepare-to-call-the-editor-api).
Bodies with arrays or objects are passed through stdin (`-`) as JSON. Any other XRPC client can send the same JSON.

## Choose an operation

| I want to...                                        | Method                                                               | Type |
| --------------------------------------------------- | -------------------------------------------------------------------- | ---- |
| Add posts (or replace and re-place existing ones)   | [`putPosts`](#add-posts-putposts)                                    | POST |
| See posts in a feed, or find posts by URI or author | [`listPosts`](#list-posts-listposts)                                 | GET  |
| Move existing posts to another position             | [`movePosts`](#move-posts-moveposts)                                 | POST |
| Remove specific posts                               | [`removePosts`](#remove-posts-removeposts)                           | POST |
| Remove all posts by one account                     | [`removePostsByAuthor`](#remove-posts-by-author-removepostsbyauthor) | POST |
| Keep only the top N posts                           | [`trimPosts`](#keep-the-top-n-posts-trimposts)                       | POST |
| Remove posts indexed before a date                  | [`prunePostsBefore`](#remove-old-posts-prunepostsbefore)             | POST |
| Fix an error that says no position is available     | [`rebalanceOrder`](#rebalance-rebalanceorder)                        | POST |

The method name is the last part of the NSID. For example, `putPosts` is `net.nusno.gyoka.feed.putPosts`.
The endpoint path is `/xrpc/{nsid}`.

The full request and response schemas are the Lexicon files in
[`packages/editor/lexicons`](../packages/editor/lexicons).

## Concepts

### Display order

Gyoka serves posts to Bluesky in the order the editor stores them. The first post in the list is shown at the top of the feed.

- A post added with the default placement (`append`) is shown at the **top**.
- Gyoka does not sort by time. The order you set is the order users see.
  `indexedAt` is a stored timestamp used by `prunePostsBefore`; it does not change the display order.

### Placement

`putPosts` and `movePosts` use `placement` to choose where posts go.

| `placement.type` | `anchor`    | Position in the displayed feed               |
| ---------------- | ----------- | -------------------------------------------- |
| `append`         | Not allowed | Top of the feed. **Default for `putPosts`.** |
| `prepend`        | Not allowed | Bottom of the feed.                          |
| `before`         | Required    | Immediately below the anchor post.           |
| `after`          | Required    | Immediately above the anchor post.           |

The anchor is a post URI that is already in the feed.

The posts you send in one request keep a fixed relative order: the **last** item in `posts` is shown highest.
Send posts oldest first, and the newest post appears at the top.

Example. The feed shows `[P1, P2, P3]` from top to bottom, and you send `[N1, N2]`:

| Placement                 | Displayed feed (top to bottom) |
| ------------------------- | ------------------------------ |
| `append`                  | `N2, N1, P1, P2, P3`           |
| `prepend`                 | `P1, P2, P3, N2, N1`           |
| `before` with anchor `P2` | `P1, P2, N2, N1, P3`           |
| `after` with anchor `P2`  | `P1, N2, N1, P2, P3`           |

### Order revision

Each feed has an `orderRevision` number. It increases when posts are added, moved, or removed.
Use it to avoid overwriting someone else's change:

- `movePosts` and `rebalanceOrder` require `expectedRevision`.
  If the revision changed, they return `RevisionConflict` and change nothing.
- A `listPosts` cursor is valid only while the revision is unchanged.
- The responses of `listPosts`, `putPosts`, and the removal and trim methods return the current `orderRevision`.

When you get `RevisionConflict`, read the feed again with `listPosts`, then retry.

### Post fields

Used by `putPosts`.

| Field       | Required | Description                                                                                                                                                                                                       |
| ----------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `uri`       | Yes      | AT URI of the post (`at://did:.../app.bsky.feed.post/...`). It must use a DID.                                                                                                                                    |
| `cid`       | Yes      | CID of the post record.                                                                                                                                                                                           |
| `languages` | No       | Up to 5 language tags. Tags are reduced to the primary tag: `en-US` becomes `en`. If omitted, empty, or if it contains `*`, the post is stored as `*` (all languages). Used when the feed has `langFilter: true`. |
| `indexedAt` | No       | Timestamp in ISO 8601 format. Defaults to the current time.                                                                                                                                                       |
| `reason`    | No       | Why the post is in the feed. See [Reasons](#reasons).                                                                                                                                                             |

### Reasons

`reason` makes Bluesky clients show the post as reposted or pinned.

```json
{
  "$type": "net.nusno.gyoka.feed.defs#skeletonReasonRepost",
  "repost": "at://did:plc:reposter/app.bsky.feed.repost/3kabc"
}
```

```json
{ "$type": "net.nusno.gyoka.feed.defs#skeletonReasonPin" }
```

## Add posts (`putPosts`)

Adds posts to one feed. You can send 1 to 1,000 posts. Each URI must appear only once in the request.

```bash
goat xrpc procedure "$GYOKA_EDITOR" net.nusno.gyoka.feed.putPosts - Content-Type:application/json <<'EOF'
{
  "feed": "at://did:plc:your-did/app.bsky.feed.generator/your-feed",
  "posts": [
    {
      "uri": "at://did:plc:author/app.bsky.feed.post/dummyvxwtw22m",
      "cid": "dummyeiabc123example456cid789xyz",
      "languages": ["en", "ja"],
      "indexedAt": "2025-01-15T12:00:00Z"
    },
    {
      "uri": "at://did:plc:author/app.bsky.feed.post/dummyvxwtw33m",
      "cid": "dummyeibcd456example789cid012xyz"
    }
  ],
  "placement": { "type": "append" }
}
EOF
```

| Field       | Required | Description                                               |
| ----------- | -------- | --------------------------------------------------------- |
| `feed`      | Yes      | Feed URI.                                                 |
| `posts`     | Yes      | 1 to 1,000 [posts](#post-fields).                         |
| `placement` | No       | [Placement](#placement). Default: `{ "type": "append" }`. |

Response:

```json
{
  "feed": "at://did:plc:your-did/app.bsky.feed.generator/your-feed",
  "orderRevision": 18
}
```

> [!NOTE]
>
> - The request is atomic. Either all posts are stored or none are.
> - If a post URI is already in the feed, `putPosts` **replaces** it.
>   Its fields (`cid`, `languages`, `indexedAt`, `reason`) are overwritten by the request,
>   and it moves to the requested placement.
>   Use [`movePosts`](#move-posts-moveposts) to change only the position.
> - The anchor must be a post that is already in the feed and not in the same request.
> - Every request that succeeds increases `orderRevision` by 1.

## List posts (`listPosts`)

Returns posts in display order (top first). You can filter by post URI and by author.
When you set more than one filter, a post must match all of them.

```bash
goat xrpc query "$GYOKA_EDITOR" net.nusno.gyoka.feed.listPosts \
  feed==at://did:plc:your-did/app.bsky.feed.generator/your-feed \
  limit==100
```

| Parameter | Required              | Description                                                                           |
| --------- | --------------------- | ------------------------------------------------------------------------------------- |
| `feed`    | Yes, without `cursor` | Feed URI.                                                                             |
| `uri`     | No                    | Return only this post.                                                                |
| `author`  | No                    | Return only posts by this DID. If `uri` is also set, its DID must match.              |
| `limit`   | No                    | 1 to 3,000. Default: 1,000.                                                           |
| `cursor`  | No                    | Cursor from the previous response. It stores the feed, the filters, and the position. |

Response:

```json
{
  "feed": "at://did:plc:your-did/app.bsky.feed.generator/your-feed",
  "orderRevision": 18,
  "posts": [
    {
      "uri": "at://did:plc:author/app.bsky.feed.post/3kaaa",
      "cid": "bafyreiabc123example456cid789xyz",
      "languages": ["en", "ja"],
      "indexedAt": "2025-01-15T12:00:00.000Z"
    }
  ],
  "cursor": "<opaque-cursor>"
}
```

To get the next page, send the cursor alone:

```bash
goat xrpc query "$GYOKA_EDITOR" net.nusno.gyoka.feed.listPosts cursor==<opaque-cursor>
```

- You may send `feed`, `uri`, or `author` together with a cursor only if they match the values stored in the cursor.
  Otherwise the request fails with `BadRequest`.
- `limit` can change between pages.
- `cursor` is omitted from the response when the page has fewer posts than `limit`.
- If the feed changes while you page through it, the next request returns `RevisionConflict`. Start again without a cursor.

## Move posts (`movePosts`)

Moves posts that are already in the feed. Only the position changes.

```bash
goat xrpc procedure "$GYOKA_EDITOR" net.nusno.gyoka.feed.movePosts - Content-Type:application/json <<'EOF'
{
  "feed": "at://did:plc:your-did/app.bsky.feed.generator/your-feed",
  "posts": ["at://did:plc:author/app.bsky.feed.post/3kaaa"],
  "placement": { "type": "after", "anchor": "at://did:plc:author/app.bsky.feed.post/3kbbb" },
  "expectedRevision": 18
}
EOF
```

| Field              | Required | Description                                                                                           |
| ------------------ | -------- | ----------------------------------------------------------------------------------------------------- |
| `feed`             | Yes      | Feed URI.                                                                                             |
| `posts`            | Yes      | 1 to 25 unique post URIs. All of them must be in the feed.                                            |
| `placement`        | Yes      | [Placement](#placement). The anchor must be in the feed and must not be one of `posts`.               |
| `expectedRevision` | Yes      | `orderRevision` you got from the last read. If it differs from the current value, nothing is changed. |

Response:

```json
{
  "feed": "at://did:plc:your-did/app.bsky.feed.generator/your-feed",
  "orderRevision": 19,
  "movedCount": 1
}
```

## Remove posts (`removePosts`)

Removes posts by URI. You can send 1 to 1,000 unique URIs.

```bash
goat xrpc procedure "$GYOKA_EDITOR" net.nusno.gyoka.feed.removePosts - Content-Type:application/json <<'EOF'
{
  "feed": "at://did:plc:your-did/app.bsky.feed.generator/your-feed",
  "uris": [
    "at://did:plc:author/app.bsky.feed.post/3kaaa",
    "at://did:plc:author/app.bsky.feed.post/3kbbb"
  ]
}
EOF
```

Response:

```json
{
  "feed": "at://did:plc:your-did/app.bsky.feed.generator/your-feed",
  "orderRevision": 20,
  "deletedCount": 2
}
```

URIs that are not in the feed are ignored. Compare `deletedCount` with the number you sent to detect them.
`orderRevision` increases only when at least one post was removed.

## Remove posts by author (`removePostsByAuthor`)

Removes every post in a feed that was written by one account. Use it to block an account from a feed.

```bash
goat xrpc procedure "$GYOKA_EDITOR" net.nusno.gyoka.feed.removePostsByAuthor \
  feed=at://did:plc:your-did/app.bsky.feed.generator/your-feed \
  author=did:plc:author
```

Response:

```json
{
  "feed": "at://did:plc:your-did/app.bsky.feed.generator/your-feed",
  "author": "did:plc:author",
  "deletedCount": 3,
  "orderRevision": 21
}
```

## Keep the top N posts (`trimPosts`)

Keeps the first `remain` posts in display order and removes the rest.
Use it to limit the size of a feed.

```bash
goat xrpc procedure "$GYOKA_EDITOR" net.nusno.gyoka.feed.trimPosts \
  feed=at://did:plc:your-did/app.bsky.feed.generator/your-feed \
  remain:=100
```

Response:

```json
{
  "feed": "at://did:plc:your-did/app.bsky.feed.generator/your-feed",
  "deletedCount": 25,
  "orderRevision": 22
}
```

`remain` is an integer of 0 or more. If the feed has `remain` posts or fewer, nothing is removed and `orderRevision` does not change.
If another change happens while trimming, the request returns `RevisionConflict`. Retry it.

## Remove old posts (`prunePostsBefore`)

Removes posts whose `indexedAt` is earlier than `before`. Posts indexed at or after `before` stay.

```bash
goat xrpc procedure "$GYOKA_EDITOR" net.nusno.gyoka.feed.prunePostsBefore \
  feed=at://did:plc:your-did/app.bsky.feed.generator/your-feed \
  before=2025-01-01T00:00:00.000Z
```

Response:

```json
{
  "feed": "at://did:plc:your-did/app.bsky.feed.generator/your-feed",
  "before": "2025-01-01T00:00:00.000Z",
  "deletedCount": 25,
  "orderRevision": 23
}
```

## Rebalance (`rebalanceOrder`)

You normally do not need this method.
Gyoka stores the position of each post as an internal rank.
After many insertions between the same two posts, no new rank may fit, and `putPosts` or `movePosts` returns `OrderRankSpaceExhausted`.
`rebalanceOrder` reassigns ranks and keeps the display order unchanged.

```bash
goat xrpc procedure "$GYOKA_EDITOR" net.nusno.gyoka.feed.rebalanceOrder \
  feed=at://did:plc:your-did/app.bsky.feed.generator/your-feed \
  expectedRevision:=23
```

Response:

```json
{
  "feed": "at://did:plc:your-did/app.bsky.feed.generator/your-feed",
  "orderRevision": 24,
  "postCount": 120
}
```

- Run it, then retry the request that failed.
- It supports feeds with up to 2,000 posts. A larger feed returns `RebalanceTooLarge`.
  Use `trimPosts` or `prunePostsBefore` first.
- If the ranks are already even (or the feed is empty), nothing is changed and `orderRevision` stays the same.

## Typical workflows

**Collector that adds new posts continuously**

1. Call `putPosts` with the new posts, oldest first, with the default placement.
2. Run `trimPosts` or `prunePostsBefore` regularly to keep the feed small.

**Pin a post to the top**

1. Read the current `orderRevision` with `listPosts`.
2. Call `movePosts` with `placement: { "type": "append" }` and that `expectedRevision`.

**Remove a spam account**

1. Call `removePostsByAuthor`.

## Errors

| Error                     | Meaning                                                                  | What to do                                                               |
| ------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `AuthenticationRequired`  | The token is missing or invalid.                                         | See [create-feed.md](create-feed.md#1-1-prepare-to-call-the-editor-api). |
| `Forbidden`               | Your DID is not in `GYOKA_EDITOR_ADMIN_DIDS`.                            | Add the DID to the editor settings and redeploy.                         |
| `BadRequest`              | Invalid input: a duplicate URI, a bad anchor, too many items, and so on. | Check the limits in this guide.                                          |
| `UnknownFeed`             | The feed URI is not registered.                                          | Register it first. See [create-feed.md](create-feed.md).                 |
| `RevisionConflict`        | The feed changed since you read it.                                      | Read the feed again, then retry.                                         |
| `OrderRankSpaceExhausted` | No position is available at the requested placement.                     | Run `rebalanceOrder`, then retry.                                        |
| `OrderConflict`           | Another change took the same position.                                   | Retry.                                                                   |
| `RebalanceTooLarge`       | The feed has too many posts for `rebalanceOrder`.                        | Reduce the feed with `trimPosts` or `prunePostsBefore`.                  |
| `InternalServerError`     | Server-side failure.                                                     | Set `DEVELOPER_MODE` to `enabled` temporarily and check logs.            |

Error response example:

```json
{
  "error": "UnknownFeed",
  "message": "Feed with URI at://did:plc:nonexistent/app.bsky.feed.generator/feed does not exist."
}
```

## Limits

| Method           | Limit                              |
| ---------------- | ---------------------------------- |
| `putPosts`       | 1 to 1,000 posts per request       |
| `removePosts`    | 1 to 1,000 URIs per request        |
| `movePosts`      | 1 to 25 posts per request          |
| `listPosts`      | `limit` 1 to 3,000 (default 1,000) |
| `rebalanceOrder` | Feeds with up to 2,000 posts       |
| Post `languages` | Up to 5 tags per post              |

All AT URIs in requests must use a DID. Handle-based URIs are not accepted.

## Other editor methods

- `net.nusno.gyoka.ping`: health check.
- `net.nusno.gyoka.document.getDocument` and `updateDocument`: read and update the Terms of Service and Privacy Policy
  that the generator publishes at `/doc/{type}`.
- Feed registration methods: [create-feed.md](create-feed.md#managing-registered-feeds).

## Developer mode

Set `DEVELOPER_MODE` to `enabled` to get detailed logs while debugging. Set it back to `disabled` in production.
