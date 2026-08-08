import { BadRequestError, InternalServerError, UnknownFeedError } from 'shared/src/errors/core';
import { FeedRow } from 'shared/src/types';

import { assertAtUriCollection } from '../validation/atUri';

const SQL_SELECT_FEED = 'SELECT * FROM feeds WHERE feed_uri = ?';
const SQL_UPDATE_LANG_FILTER = 'UPDATE feeds SET lang_filter = ? WHERE feed_uri = ?';
const SQL_UPDATE_IS_ACTIVE = 'UPDATE feeds SET is_active = ? WHERE feed_uri = ?';

type UpdateFeedInput = {
  uri: string;
  langFilter?: boolean;
  isActive?: boolean;
};

export async function updateFeed(db: Env['DB'], input: UpdateFeedInput): Promise<Response> {
  const { uri, langFilter, isActive } = input;

  assertAtUriCollection(uri, 'app.bsky.feed.generator', 'feed URI');

  if (langFilter === undefined && isActive === undefined) {
    throw new BadRequestError('No value for update in request');
  }

  const { success: selectSuccess, results } = await db
    .prepare(SQL_SELECT_FEED)
    .bind(uri)
    .all<FeedRow>();
  if (!selectSuccess) {
    throw new InternalServerError('Failed to query the database');
  }
  if (results.length === 0) {
    throw new UnknownFeedError(`Feed with URI ${uri} does not exist`);
  }

  const feed = results[0];
  const statements: D1PreparedStatement[] = [];

  if (langFilter !== undefined) {
    statements.push(db.prepare(SQL_UPDATE_LANG_FILTER).bind(langFilter, uri));
    feed.lang_filter = langFilter ? 1 : 0;
  }
  if (isActive !== undefined) {
    statements.push(db.prepare(SQL_UPDATE_IS_ACTIVE).bind(isActive, uri));
    feed.is_active = isActive ? 1 : 0;
  }

  const batchResult = await db.batch(statements);
  if (!batchResult.every((result) => result.success)) {
    throw new InternalServerError('Failed to update feed');
  }

  return Response.json({
    message: 'Feed updated successfully',
    feed: {
      uri: feed.feed_uri,
      langFilter: feed.lang_filter === 1,
      isActive: feed.is_active === 1,
    },
  });
}
