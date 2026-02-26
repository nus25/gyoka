import { DOCUMENT_TYPES } from 'shared/src/constants';
import { InternalServerError } from 'shared/src/errors/core';

// https://github.com/bluesky-social/atproto/blob/main/lexicons/app/bsky/feed/describeFeedGenerator.json

const SQL_SELECT_FEED = 'SELECT feed_uri FROM feeds WHERE is_active = 1';
const SQL_SELECT_DOCUMENT = 'SELECT type, url FROM documents';

export async function describeFeedGenerator(env: Env): Promise<Response> {
  const db: D1Database = env.DB;
  const { success: feedSuccess, results: feedResults } = await db.prepare(SQL_SELECT_FEED).all();
  if (!feedSuccess) {
    throw new InternalServerError('Failed to fetch feeds');
  }

  const { success: docSuccess, results: docResults } = await db.prepare(SQL_SELECT_DOCUMENT).all();

  if (!docSuccess) {
    throw new InternalServerError('Failed to fetch links');
  }

  const linkMap = docResults.reduce(
    (acc, row) => {
      const type = row.type;
      const url = row.url;
      if (type === DOCUMENT_TYPES.PRIVACY_POLICY) {
        if (!url) {
          acc.privacyPolicy = `https://${env.FEEDGEN_HOST}/doc/${DOCUMENT_TYPES.PRIVACY_POLICY}`;
        } else {
          acc.privacyPolicy = url;
        }
      } else if (type === DOCUMENT_TYPES.TOS) {
        if (!url) {
          acc.termsOfService = `https://${env.FEEDGEN_HOST}/doc/${DOCUMENT_TYPES.TOS}`;
        } else {
          acc.termsOfService = url;
        }
      }
      return acc;
    },
    {} as { privacyPolicy?: string; termsOfService?: string }
  );

  const response = {
    did: env.FEEDGEN_PUBLISHER_DID,
    feeds: [...feedResults.map((feed) => ({ uri: feed.feed_uri }))],
    links: undefined as { privacyPolicy?: string; termsOfService?: string } | undefined,
  };

  if (Object.keys(linkMap).length > 0) {
    response.links = linkMap;
  }
  return Response.json(response);
}
