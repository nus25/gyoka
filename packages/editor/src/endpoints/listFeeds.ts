import { InternalServerError } from 'shared/src/errors/core';
import { FeedRow } from 'shared/src/types';

const SQL_SELECT_FEEDS = 'SELECT feed_uri, lang_filter, is_active, order_revision FROM feeds';

export async function listFeeds(
  db: Env['DB'],
  context?: Record<string, unknown>
): Promise<Response> {
  if (context) context.stage = 'read';
  try {
    const { success, results } = await db.prepare(SQL_SELECT_FEEDS).all<FeedRow>();
    if (!success) {
      throw new InternalServerError('Failed to fetch feeds');
    }

    if (context) context.resultCount = results.length;
    return Response.json({
      feeds: results.map((feed) => ({
        uri: feed.feed_uri,
        langFilter: feed.lang_filter === 1,
        isActive: feed.is_active === 1,
        orderRevision: feed.order_revision,
      })),
    });
  } catch {
    throw new InternalServerError('Failed to fetch feeds');
  }
}
