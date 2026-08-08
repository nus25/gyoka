import { InternalServerError } from 'shared/src/errors/core';
import { FeedRow } from 'shared/src/types';

const SQL_SELECT_FEED = 'SELECT * FROM feeds';

export async function listFeeds(db: Env['DB']): Promise<Response> {
  try {
    const { success, results } = await db.prepare(SQL_SELECT_FEED).all<FeedRow>();
    if (!success) {
      throw new InternalServerError('Failed to fetch feeds');
    }

    return Response.json({
      feeds: results.map((feed) => ({
        uri: feed.feed_uri,
        langFilter: feed.lang_filter === 1,
        isActive: feed.is_active === 1,
      })),
    });
  } catch {
    throw new InternalServerError('Failed to fetch feeds');
  }
}
