import { env } from 'cloudflare:workers';
import { OrderRank } from 'shared/src/gyokaRank';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  getFeed,
  getFeedAndPlacementBounds,
  normalizeLanguages,
  ranksForPlacement,
  requirePostUris,
} from '../src/endpoints/postMutation.shared';
import { FEED_URI, insertFeed, resetFeedTables } from './feedTest.shared';

const POST_URI = 'at://did:plc:author/app.bsky.feed.post/post';

describe('postMutation.shared error cases', () => {
  beforeEach(resetFeedTables);

  it('Given no post URIs When requirePostUris is called Then it throws bad request', () => {
    expect(() => requirePostUris([])).toThrow('posts must contain between 1 and 25 unique URIs.');
  });

  it('Given more than 25 post URIs When requirePostUris is called Then it throws bad request', () => {
    const uris = Array.from({ length: 26 }, (_, index) => `${POST_URI}-${index}`);

    expect(() => requirePostUris(uris)).toThrow('posts must contain between 1 and 25 unique URIs.');
  });

  it('Given more than five unique languages When normalizing languages Then it throws bad request', () => {
    expect(() => normalizeLanguages(['en', 'ja', 'fr', 'de', 'es', 'it'])).toThrow(
      'languages must contain at most 5 values.'
    );
  });

  it('Given more than eight post URIs When requirePostUris is called with the batch limit Then it throws bad request', () => {
    const uris = Array.from({ length: 9 }, (_, index) => `${POST_URI}-${index}`);

    expect(() => requirePostUris(uris, 8)).toThrow(
      'posts must contain between 1 and 8 unique URIs.'
    );
  });

  it('Given a feed URI from the wrong collection When getFeed is called Then it throws bad request', async () => {
    await expect(
      getFeed({} as D1Database, 'at://did:plc:author/app.bsky.feed.post/feed')
    ).rejects.toMatchObject({ errorCode: 'BadRequest' });
  });

  it('Given the placement anchor is missing When ranksForPlacement is called Then it throws bad request', () => {
    expect(() =>
      ranksForPlacement(
        [{ uri: POST_URI, order_rank: 'a0' as OrderRank }],
        { type: 'before', anchor: `${POST_URI}-missing` },
        1
      )
    ).toThrow('Placement anchor does not exist.');
  });

  it('Given the feed does not exist When getFeed is called Then it throws unknown feed', async () => {
    const db = {
      prepare: () => ({ bind: () => ({ first: async () => null }) }),
    } as unknown as D1Database;

    await expect(getFeed(db, FEED_URI)).rejects.toMatchObject({ errorCode: 'UnknownFeed' });
  });

  it('Given the feed does not exist When getting placement bounds Then it throws unknown feed', async () => {
    await expect(
      getFeedAndPlacementBounds(env.DB, FEED_URI, { type: 'append' }, [])
    ).rejects.toMatchObject({ errorCode: 'UnknownFeed' });
  });

  it('Given a missing anchor When getting placement bounds Then it throws bad request', async () => {
    await insertFeed(FEED_URI);

    await expect(
      getFeedAndPlacementBounds(
        env.DB,
        FEED_URI,
        {
          type: 'before',
          anchor: POST_URI,
        },
        []
      )
    ).rejects.toMatchObject({ errorCode: 'BadRequest' });
  });
});
