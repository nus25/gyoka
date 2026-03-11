import { env } from 'cloudflare:test';
import { DOCUMENT_TYPES } from 'shared/src/constants';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  expectJson200,
  insertDocuments,
  insertFeeds,
  requestDescribeFeedGeneratorJson,
  resetDescribeFeedGeneratorTables,
} from './describeFeedGenerator.shared';

describe('Boundary cases', () => {
  beforeEach(async () => {
    await resetDescribeFeedGeneratorTables();
  });

  it('Given no active feeds When describing generator Then empty feeds are returned', async () => {
    await insertFeeds([
      { uri: 'at://did:plc:testuser/app.bsky.feed.generator/gyoka_feed1', is_active: 0 },
    ]);

    const { response, json } = await requestDescribeFeedGeneratorJson();

    expectJson200(response);
    expect(json).toEqual({
      did: env.FEEDGEN_PUBLISHER_DID,
      feeds: [],
    });
  });

  it('Given no documents When describing generator Then links are omitted', async () => {
    const { response, json } = await requestDescribeFeedGeneratorJson();

    expectJson200(response);
    expect(json).toEqual({
      did: env.FEEDGEN_PUBLISHER_DID,
      feeds: [],
    });
  });

  it('Given null URL documents When describing generator Then default document URLs are used', async () => {
    await insertDocuments([
      { type: DOCUMENT_TYPES.PRIVACY_POLICY, url: null },
      { type: DOCUMENT_TYPES.TOS, url: null },
    ]);

    const { response, json } = await requestDescribeFeedGeneratorJson();

    expectJson200(response);
    expect(json).toEqual({
      did: env.FEEDGEN_PUBLISHER_DID,
      feeds: [],
      links: {
        privacyPolicy: `https://${env.FEEDGEN_HOST}/doc/${DOCUMENT_TYPES.PRIVACY_POLICY}`,
        termsOfService: `https://${env.FEEDGEN_HOST}/doc/${DOCUMENT_TYPES.TOS}`,
      },
    });
  });

  it('Given unknown document type When describing generator Then links are not included', async () => {
    await insertDocuments([{ type: 'unknown_type', url: 'http://example.com/unknown' }]);

    const { response, json } = await requestDescribeFeedGeneratorJson();

    expectJson200(response);
    expect(json).toEqual({
      did: env.FEEDGEN_PUBLISHER_DID,
      feeds: [],
    });
  });
});
