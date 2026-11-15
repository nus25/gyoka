PRAGMA foreign_keys = ON;

-- Migration number: 0000 
DROP TABLE IF EXISTS feeds;
CREATE TABLE IF NOT EXISTS feeds (
    feed_id INTEGER PRIMARY KEY AUTOINCREMENT, -- Gyoka feed id
    feed_uri TEXT NOT NULL UNIQUE,             -- feed AT URI
    lang_filter BOOLEAN NOT NULL DEFAULT 1,    -- flag for use language filter
    is_active BOOLEAN NOT NULL DEFAULT 1,      -- flag for active feed
        order_revision INTEGER NOT NULL DEFAULT 0 CHECK(order_revision >= 0)
);



DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS post_languages;
-- ポストテーブルの作成
CREATE TABLE IF NOT EXISTS posts (
    post_id INTEGER PRIMARY KEY AUTOINCREMENT,
    feed_id INTEGER NOT NULL,  -- Gyoka feed id
    cid TEXT NOT NULL,         -- post CID
    uri TEXT NOT NULL,         -- post AT URI
    indexed_at TEXT NOT NULL CHECK(indexed_at GLOB '????-??-??T??:??:??*Z'), -- ISO8601（ms）timestamp string
    reason TEXT CHECK (json_valid(reason)), -- JSON format reason
    order_rank TEXT COLLATE BINARY NOT NULL,
    UNIQUE (feed_id, uri),
    FOREIGN KEY (feed_id) REFERENCES feeds(feed_id) ON DELETE CASCADE
);
-- ポストの言語テーブルの作成
CREATE TABLE IF NOT EXISTS post_languages (
    post_id INTEGER NOT NULL, 
    language TEXT NOT NULL   CHECK (
        language = '*' OR
        (length(language) = 2 AND language GLOB '[a-z][a-z]') or
        (length(language) = 3 AND language GLOB '[a-z][a-z][a-z]')
    ), -- BCP-47 primary language tag(en, ja, tlh etc.). '*' is for all languages
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, language)
);


-- tos等テキスト情報テーブルの作成
DROP TABLE IF EXISTS documents;
CREATE TABLE IF NOT EXISTS documents (
    type TEXT NOT NULL UNIQUE,
    url TEXT,
    content TEXT
);

-- Drop existing indexes if they exist
DROP INDEX IF EXISTS idx_post_languages_language_post_id;
DROP INDEX IF EXISTS idx_posts_uri;
DROP INDEX IF EXISTS uq_posts_feed_order_rank;
CREATE INDEX IF NOT EXISTS idx_post_languages_language_post_id ON post_languages(language, post_id);
CREATE INDEX IF NOT EXISTS idx_posts_uri ON posts(uri); -- For Deleting by URI
CREATE UNIQUE INDEX IF NOT EXISTS uq_posts_feed_order_rank ON posts(feed_id, order_rank COLLATE BINARY);

-- optimize the database
PRAGMA optimize;
