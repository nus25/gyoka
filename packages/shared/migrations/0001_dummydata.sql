-- Migration number: 0001
INSERT INTO documents (type, url, content) VALUES
('tos', 'https://example.com/tos', 'dummy term of service'),
('privacy_policy', NULL, 'dummy privacy polisy');

INSERT INTO feeds (feed_uri, is_active) VALUES
('at://did:plc:testuser/app.bsky.feed.generator/gyoka_feed1', 1),
('at://did:plc:testuser/app.bsky.feed.generator/gyoka_feed2', 1),
('at://did:plc:testuser/app.bsky.feed.generator/gyoka_feed3', 0),
('at://did:plc:testuser/app.bsky.feed.generator/gyoka_feed4', 1),
('at://did:plc:1234abcd/app.bsky.feed.generator/record123', 1);

INSERT INTO posts (post_id, cid, did, uri, indexed_at, feed_id, feed_context, reason) VALUES
(1,'bafkqacbqv4g3j', 'did:plc:testuser', 'at://did:plc:testuser/app.bsky.feed.post/bafkqacbqv4g3j', '2024-12-31T15:00:00.000Z', 1,null, null),
(2,'bafkqacbqv4g3k', 'did:plc:testuser', 'at://did:plc:testuser/app.bsky.feed.post/bafkqacbqv4g3k', '2025-01-01T15:00:00.000Z', 1,null, null),
(3,'bafkqacbqv4g3l', 'did:plc:testuser', 'at://did:plc:testuser/app.bsky.feed.post/bafkqacbqv4g3l', '2025-01-02T15:00:00.000Z', 2,null, null),
(4,'bafkqacbqv4g3m', 'did:plc:testuser', 'at://did:plc:testuser/app.bsky.feed.post/bafkqacbqv4g3m', '2025-01-03T15:00:00.000Z', 2,null, null),
(5,'bafkqacbqv4g3n', 'did:plc:testuser', 'at://did:plc:testuser/app.bsky.feed.post/bafkqacbqv4g3n', '2025-01-04T15:00:00.000Z', 3,null, null),
(6,'bafkqacbqv4g3o', 'did:plc:testuser', 'at://did:plc:testuser/app.bsky.feed.post/bafkqacbqv4g3o', '2025-01-05T15:00:00.000Z', 4,'some context', null),
(7,'bafkqacbqv4g3p', 'did:plc:testuser', 'at://did:plc:testuser/app.bsky.feed.post/bafkqacbqv4g3p', '2025-01-06T15:00:00.000Z', 1,null, '{"repost":"at://did:plc:testuser/app.bsky.feed.repost/repostrkey"}');

INSERT INTO post_languages (post_id, language) VALUES
(1,'ja'),
(2,'en'),
(3,'en'),
(3,'ja'),
(4,'ja'),
(5,'en'),
(6,'ja'),
(7,'ja');
