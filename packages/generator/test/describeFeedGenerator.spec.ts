import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/index';
import { DOCUMENT_TYPES } from 'shared/src/constants';

const BASE_URL = 'http://localhost:8787';
const ENDPOINT_PATH = '/xrpc/app.bsky.feed.describeFeedGenerator';

const dummyFeeds = [
  {
    uri: `at://did:plc:testuser/app.bsky.feed.generator/gyoka_feed1`,
  },
  {
    uri: `at://did:plc:testuser/app.bsky.feed.generator/gyoka_feed2`,
  },
  {
    uri: `at://did:plc:testuser/app.bsky.feed.generator/gyoka_feed3`,
  },
  {
    uri: `at://did:plc:elseuser/app.bsky.feed.generator/gyoka_feed4`,
  },
];

// request helper
async function getServerDescription() {
  const request = new Request(`${BASE_URL}${ENDPOINT_PATH}`);
  const ctx = createExecutionContext();
  const response = await app.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return {
    response,
    json: await response.json(),
  };
}

// response validation helper
function assertValidResponse(response: Response) {
  expect(response.status).toBe(200);
  expect(response.headers.get('Content-Type')).toBe('application/json');
}

// database helpers
async function insertFeeds(feeds: Array<{ uri: string; is_active: number }>) {
  const db = env.DB;

  const placeholders = feeds.map(() => '(?, ?)').join(', ');
  const values = feeds.flatMap(({ uri, is_active: active }) => [uri, active]);
  await db
    .prepare(`INSERT INTO feeds (feed_uri, is_active) VALUES ${placeholders}`)
    .bind(...values)
    .run();
}

async function insertDocuments(documents: Array<{ type: string; url: string }>) {
  const db = env.DB;
  const placeholders = documents.map(() => '(?, ?)').join(', ');
  const values = documents.flatMap(({ type, url }) => [type, url]);
  await db
    .prepare(`INSERT INTO documents (type, url) VALUES ${placeholders}`)
    .bind(...values)
    .run();
}

describe('app.bsky.feed.describeFeedGenerator', async () => {
  beforeEach(async () => {
    const db = env.DB;
    await db.prepare('DELETE FROM documents').run();
    await db.prepare('DELETE FROM feeds').run();
  });

  it('returns server description with feeds', async () => {
    await insertFeeds([
      { uri: dummyFeeds[0].uri, is_active: 1 },
      { uri: dummyFeeds[1].uri, is_active: 1 },
      { uri: dummyFeeds[2].uri, is_active: 0 }, // inactive feed
      { uri: dummyFeeds[3].uri, is_active: 1 },
    ]);

    const { response, json } = await getServerDescription();
    assertValidResponse(response);
    expect(json).toEqual({
      did: env.FEEDGEN_PUBLISHER_DID,
      feeds: expect.arrayContaining([
        { uri: dummyFeeds[0].uri },
        { uri: dummyFeeds[1].uri },
        { uri: dummyFeeds[3].uri },
      ]),
    });
  });

  it('returns server description with empty feeds', async () => {
    await insertFeeds([{ uri: dummyFeeds[0].uri, is_active: 0 }]);

    const { response, json } = await getServerDescription();
    assertValidResponse(response);
    expect(json).toEqual({
      did: env.FEEDGEN_PUBLISHER_DID,
      feeds: [],
    });
  });

  it('returns server discription without links if not set', async () => {
    const { response, json } = await getServerDescription();
    assertValidResponse(response);
    expect(json).toEqual({
      did: env.FEEDGEN_PUBLISHER_DID,
      feeds: [],
    });
  });

  it('returns server description with tos link', async () => {
    await insertDocuments([{ type: DOCUMENT_TYPES.TOS, url: 'http://example.com/tos' }]);

    const { response, json } = await getServerDescription();
    assertValidResponse(response);
    expect(json).toEqual({
      did: env.FEEDGEN_PUBLISHER_DID,
      feeds: [],
      links: {
        termsOfService: 'http://example.com/tos',
      },
    });
  });

  it('returns server description with privacyPolicy link', async () => {
    await insertDocuments([
      { type: DOCUMENT_TYPES.PRIVACY_POLICY, url: 'http://example.com/privacy' },
    ]);

    const { response, json } = await getServerDescription();
    assertValidResponse(response);
    expect(json).toEqual({
      did: env.FEEDGEN_PUBLISHER_DID,
      feeds: [],
      links: {
        privacyPolicy: 'http://example.com/privacy',
      },
    });
  });

  it('returns server description with both privacyPolicy and tos links', async () => {
    await insertDocuments([
      { type: DOCUMENT_TYPES.PRIVACY_POLICY, url: 'http://example.com/privacy' },
      { type: DOCUMENT_TYPES.TOS, url: 'http://example.com/tos' },
    ]);

    const { response, json } = await getServerDescription();
    assertValidResponse(response);
    expect(json).toEqual({
      did: env.FEEDGEN_PUBLISHER_DID,
      feeds: [],
      links: {
        privacyPolicy: 'http://example.com/privacy',
        termsOfService: 'http://example.com/tos',
      },
    });
  });

  it('returns server description with default privacyPolicy link', async () => {
    await insertDocuments([{ type: DOCUMENT_TYPES.PRIVACY_POLICY, url: null }]);

    const { response, json } = await getServerDescription();
    assertValidResponse(response);
    expect(json).toEqual({
      did: env.FEEDGEN_PUBLISHER_DID,
      feeds: [],
      links: {
        privacyPolicy: `https://${env.FEEDGEN_HOST}/doc/${DOCUMENT_TYPES.PRIVACY_POLICY}`,
      },
    });
  });

  it('returns server description with default tos link', async () => {
    await insertDocuments([{ type: DOCUMENT_TYPES.TOS, url: null }]);

    const { response, json } = await getServerDescription();
    assertValidResponse(response);
    expect(json).toEqual({
      did: env.FEEDGEN_PUBLISHER_DID,
      feeds: [],
      links: {
        termsOfService: `https://${env.FEEDGEN_HOST}/doc/${DOCUMENT_TYPES.TOS}`,
      },
    });
  });
});
