import { type Context } from 'hono';

export type AppContext = Context<{ Bindings: Env }>;

// SQLite BOOLEAN values are persisted as integer flags in D1.
export type SqliteBoolean = 0 | 1;

export type FeedRow = {
  feed_id: number;
  feed_uri: string;
  lang_filter: SqliteBoolean;
  is_active: SqliteBoolean;
};

export type { ErrorResponse } from './errors';
