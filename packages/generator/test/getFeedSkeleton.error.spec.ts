import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getFeedSkeleton } from '../src/endpoints/getFeedSkeleton';
import {
  ACTIVE_FEED_URI,
  ErrorResponse,
  FeedSkeletonResponse,
  INACTIVE_FEED_URI,
  requestFeedSkeleton,
  resetAndSeedFeeds,
} from './getFeedSkeleton.shared';

describe('Error cases', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    await resetAndSeedFeeds();
  });

  it('Given a malformed cursor When requesting a skeleton Then the failure log includes safe request context', async () => {
    const output = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const response = await requestFeedSkeleton(`feed=${ACTIVE_FEED_URI}&cursor=malformedcursor`);

    expect(response.status).toBe(400);
    const records = output.mock.calls.map(([line]) => JSON.parse(String(line)));
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      operation: 'getFeedSkeleton',
      stage: 'validation',
      hasCursor: true,
      errorCode: 'BadRequest',
    });
    expect(JSON.stringify(records)).not.toContain('malformedcursor');
  });

  it('Given unknown feed URI When requesting skeleton Then it returns 404 UnknownFeed', async () => {
    const response = await requestFeedSkeleton(
      'feed=at://did:plc:testuser/app.bsky.feed.generator/non_feed'
    );

    expect(response.status).toBe(404);
    const data: ErrorResponse = await response.json();
    expect(data.error).toBe('UnknownFeed');
  });

  it('Given inactive feed URI When requesting skeleton Then it returns an empty feed', async () => {
    const response = await requestFeedSkeleton(`feed=${INACTIVE_FEED_URI}`);

    expect(response.status).toBe(200);
    const data: FeedSkeletonResponse = await response.json();
    expect(data.feed).toEqual([]);
  });

  it('Given malformed cursor When requesting skeleton Then it returns 400 BadRequest', async () => {
    const response = await requestFeedSkeleton(`feed=${ACTIVE_FEED_URI}&cursor=malformedcursor`);

    expect(response.status).toBe(400);
    const data: ErrorResponse = await response.json();
    expect(data.error).toBe('BadRequest');
    expect(data.message).toBe('Malformed cursor');
  });

  it('Given a cursor with an unsupported version When requesting skeleton Then it returns 400 BadRequest', async () => {
    const cursor = btoa(JSON.stringify({ version: 1, feed: ACTIVE_FEED_URI }));

    const response = await requestFeedSkeleton(`feed=${ACTIVE_FEED_URI}&cursor=${cursor}`);

    expect(response.status).toBe(400);
    const data: ErrorResponse = await response.json();
    expect(data).toMatchObject({ error: 'BadRequest', message: 'Malformed cursor' });
  });

  it('Given a v3 cursor without a rank When requesting skeleton Then it returns 400 BadRequest', async () => {
    const cursor = btoa(JSON.stringify({ version: 3, feed: ACTIVE_FEED_URI }));

    const response = await requestFeedSkeleton(`feed=${ACTIVE_FEED_URI}&cursor=${cursor}`);

    expect(response.status).toBe(400);
    const data: ErrorResponse = await response.json();
    expect(data).toMatchObject({ error: 'BadRequest', message: 'Malformed cursor' });
  });

  it('Given out-of-range cursor timestamp When requesting skeleton Then it returns 400 BadRequest', async () => {
    const response = await requestFeedSkeleton(
      `feed=${ACTIVE_FEED_URI}&cursor=999999999999999999999::cid1`
    );

    expect(response.status).toBe(400);
    const data: ErrorResponse = await response.json();
    expect(data.error).toBe('BadRequest');
    expect(data.message).toBe('Malformed cursor');
  });

  it('Given invalid feed URI format When requesting skeleton Then it returns 400 BadRequest', async () => {
    const response = await requestFeedSkeleton('feed=invalid-feed-uri');

    expect(response.status).toBe(400);
    const data: ErrorResponse = await response.json();
    expect(data.error).toBe('BadRequest');
  });

  it('Given syntactically invalid feed URI When requesting skeleton Then it returns 400 BadRequest', async () => {
    await expect(
      getFeedSkeleton({
        env,
        request: new Request('http://localhost'),
        feed: 'invalid-feed-uri',
        limit: 50,
      })
    ).rejects.toMatchObject({ message: 'Invalid feed URI format' });
  });

  it('Given a cursor for another feed When requesting skeleton Then it returns 400 BadRequest', async () => {
    const cursor = btoa(
      JSON.stringify({
        version: 3,
        feed: 'at://did:plc:testuser/app.bsky.feed.generator/anotherfeed',
        orderRank: 'a1',
      })
    );

    const response = await requestFeedSkeleton(`feed=${ACTIVE_FEED_URI}&cursor=${cursor}`);

    expect(response.status).toBe(400);
    const data: ErrorResponse = await response.json();
    expect(data).toMatchObject({
      error: 'BadRequest',
      message: 'Cursor does not match the requested feed.',
    });
  });

  it('Given invalid feed URI collection When requesting skeleton Then it returns 400 BadRequest', async () => {
    const response = await requestFeedSkeleton(
      'feed=at://did:plc:testuser/app.bsky.feed.invalid/feed'
    );

    expect(response.status).toBe(400);
    const data: ErrorResponse = await response.json();
    expect(data.error).toBe('BadRequest');
  });

  it('Given invalid feed URI format When requesting skeleton Then it returns 400 BadRequest', async () => {
    const response = await requestFeedSkeleton('feed=invalid-feed-uri');

    expect(response.status).toBe(400);
    const data: ErrorResponse = await response.json();
    expect(data.error).toBe('BadRequest');
  });

  it('Given handle-based feed URI format When requesting skeleton Then it returns 400 BadRequest', async () => {
    const response = await requestFeedSkeleton(
      'feed=at://test.example.com/app.bsky.feed.generator/feed'
    );

    expect(response.status).toBe(400);
    const data: ErrorResponse = await response.json();
    expect(data.error).toBe('BadRequest');
    expect(data.message).toBe('DID-based AT URI is required');
  });

  it('Given invalid query parameter type When requesting skeleton Then the issue count is logged but issues are excluded from response', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const response = await requestFeedSkeleton(`feed=${ACTIVE_FEED_URI}&limit=abc`);

    expect(response.status).toBe(400);
    const data = (await response.json()) as ErrorResponse & {
      'net.kelinci.atcute.issues'?: unknown;
    };
    expect(data.error).toBe('BadRequest');
    expect(data['net.kelinci.atcute.issues']).toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();

    const payload = JSON.parse(warnSpy.mock.calls[0][0] as string) as Record<string, unknown>;
    expect(payload.event).toBe('api.validate.request.failed');
    expect(payload.issueCount).toBeGreaterThan(0);
    expect(payload.issues).toBeUndefined();
  });

  it('Given post query failure When requesting skeleton Then it returns 500', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await requestFeedSkeleton(
      'feed=at://did:plc:testuser/app.bsky.feed.generator/post_query_failure',
      {},
      {
        ...env,
        DB: {
          prepare: () => ({
            bind: () => ({
              all: async () => {
                return { success: false, results: [] };
              },
            }),
          }),
        },
      } as unknown as typeof env
    );

    expect(response.status).toBe(500);
    const data: ErrorResponse = await response.json();
    expect(data).toEqual({
      error: 'InternalServerError',
      message: 'Failed to fetch feed skeleton',
    });
    expect(errorSpy).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(errorSpy.mock.calls[0][0] as string) as Record<string, unknown>;
    expect(payload.event).toBe('api.handle.exception.failed');
    expect(payload.status).toBe(500);
  });

  it('Given feed existence query failure When requesting skeleton Then it returns 500', async () => {
    const response = await requestFeedSkeleton(
      'feed=at://did:plc:testuser/app.bsky.feed.generator/existence_query_failure',
      {},
      {
        ...env,
        DB: {
          prepare: (query: string) => ({
            bind: () => ({
              all: async () =>
                query.startsWith('SELECT 1 FROM feeds')
                  ? { success: false, results: [] }
                  : { success: true, results: [] },
            }),
          }),
        },
      } as unknown as typeof env
    );

    expect(response.status).toBe(500);
    const data: ErrorResponse = await response.json();
    expect(data).toEqual({
      error: 'InternalServerError',
      message: 'Failed to check feed existence',
    });
  });
});
