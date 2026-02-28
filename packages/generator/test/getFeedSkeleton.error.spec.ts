import { env } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACTIVE_FEED_URI,
  ErrorResponse,
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

  it('Given unknown feed URI When requesting skeleton Then it returns 404 UnknownFeed', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await requestFeedSkeleton(
      'feed=at://did:plc:testuser/app.bsky.feed.generator/non_feed'
    );

    expect(response.status).toBe(404);
    const data: ErrorResponse = await response.json();
    expect(data.error).toBe('UnknownFeed');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();

    const payload = JSON.parse(warnSpy.mock.calls[0][0] as string) as Record<string, unknown>;
    expect(payload.event).toBe('api.handle.exception.failed');
    expect(payload.status).toBe(404);
  });

  it('Given inactive feed URI When requesting skeleton Then it returns 404 UnknownFeed', async () => {
    const response = await requestFeedSkeleton(`feed=${INACTIVE_FEED_URI}`);

    expect(response.status).toBe(404);
    const data: ErrorResponse = await response.json();
    expect(data.error).toBe('UnknownFeed');
  });

  it('Given malformed cursor When requesting skeleton Then it returns 400 BadRequest', async () => {
    const response = await requestFeedSkeleton(`feed=${ACTIVE_FEED_URI}&cursor=malformedcursor`);

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

  it('Given invalid query parameter type When requesting skeleton Then issues are logged but excluded from response', async () => {
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
    expect(Array.isArray(payload.issues)).toBe(true);
  });

  it('Given main query failure When requesting skeleton Then it returns 500', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await requestFeedSkeleton(`feed=${ACTIVE_FEED_URI}`, {}, {
      ...env,
      DB: {
        prepare: () => ({
          bind: () => ({
            all: async () => ({ success: false, results: [] }),
          }),
        }),
      },
    } as unknown as typeof env);

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

  it('Given feed existence verification failure When requesting skeleton Then it returns 500', async () => {
    let callCount = 0;
    const response = await requestFeedSkeleton(`feed=${ACTIVE_FEED_URI}`, {}, {
      ...env,
      DB: {
        prepare: () => ({
          bind: () => ({
            all: async () => {
              callCount += 1;
              if (callCount === 1) {
                return { success: true, results: [] };
              }
              return { success: false, results: [] };
            },
          }),
        }),
      },
    } as unknown as typeof env);

    expect(response.status).toBe(500);
    const data: ErrorResponse = await response.json();
    expect(data).toEqual({
      error: 'InternalServerError',
      message: 'Failed to verify feed existence',
    });
  });
});
