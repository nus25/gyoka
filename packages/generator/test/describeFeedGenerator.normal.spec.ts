import { env } from 'cloudflare:workers';
import { DOCUMENT_TYPES } from 'shared/src/constants';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  expectJson200,
  insertDocuments,
  insertFeeds,
  requestDescribeFeedGeneratorJson,
  resetDescribeFeedGeneratorTables,
} from './describeFeedGenerator.shared';

const dummyFeeds = [
  {
    uri: 'at://did:plc:testuser/app.bsky.feed.generator/gyoka_feed1',
  },
  {
    uri: 'at://did:plc:testuser/app.bsky.feed.generator/gyoka_feed2',
  },
  {
    uri: 'at://did:plc:testuser/app.bsky.feed.generator/gyoka_feed3',
  },
  {
    uri: 'at://did:plc:elseuser/app.bsky.feed.generator/gyoka_feed4',
  },
];

describe('Success cases', () => {
  beforeEach(async () => {
    await resetDescribeFeedGeneratorTables();
  });

  it('Given active and inactive feeds When describing generator Then only active feeds are returned', async () => {
    await insertFeeds([
      { uri: dummyFeeds[0].uri, is_active: 1 },
      { uri: dummyFeeds[1].uri, is_active: 1 },
      { uri: dummyFeeds[2].uri, is_active: 0 },
      { uri: dummyFeeds[3].uri, is_active: 1 },
    ]);

    const { response, json } = await requestDescribeFeedGeneratorJson();

    expectJson200(response);
    expect(json).toEqual({
      did: env.FEEDGEN_PUBLISHER_DID,
      feeds: expect.not.arrayContaining([{ uri: dummyFeeds[2].uri }]),
    });
  });

  it('Given tos URL document When describing generator Then termsOfService link is returned', async () => {
    await insertDocuments([{ type: DOCUMENT_TYPES.TOS, url: 'http://example.com/tos' }]);

    const { response, json } = await requestDescribeFeedGeneratorJson();

    expectJson200(response);
    expect(json).toEqual({
      did: env.FEEDGEN_PUBLISHER_DID,
      feeds: [],
      links: {
        termsOfService: 'http://example.com/tos',
      },
    });
  });

  it('Given privacyPolicy URL document When describing generator Then privacyPolicy link is returned', async () => {
    await insertDocuments([
      { type: DOCUMENT_TYPES.PRIVACY_POLICY, url: 'http://example.com/privacy' },
    ]);

    const { response, json } = await requestDescribeFeedGeneratorJson();

    expectJson200(response);
    expect(json).toEqual({
      did: env.FEEDGEN_PUBLISHER_DID,
      feeds: [],
      links: {
        privacyPolicy: 'http://example.com/privacy',
      },
    });
  });
});
