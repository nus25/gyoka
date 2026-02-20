import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_DID_CACHE_REVALIDATE_INTERVAL_SECONDS,
  DEFAULT_DID_CACHE_TTL_SECONDS,
  DEFAULT_DID_CACHE_TIMESTAMP_GRANULARITY_SECONDS,
  createDidResolverFetch,
  resolveDidCacheRevalidateIntervalSeconds,
  resolveDidCacheTimestampGranularitySeconds,
  resolveDidCacheTtlSeconds,
} from '../src/auth/didResolverCache';

describe('didResolverCache', () => {
  const DID_CACHE_TIMESTAMP_HEADER = 'x-gyoka-did-cached-at';
  const DID_REVALIDATED_TIMESTAMP_HEADER = 'x-gyoka-did-revalidated-at';

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('Given undefined ttl env When resolving ttl Then default 30 days is used', () => {
    expect(resolveDidCacheTtlSeconds(undefined)).toBe(DEFAULT_DID_CACHE_TTL_SECONDS);
  });

  it('Given valid ttl env When resolving ttl Then configured value is used', () => {
    expect(resolveDidCacheTtlSeconds('600')).toBe(600);
  });

  it('Given invalid ttl env When resolving ttl Then default 30 days is used', () => {
    expect(resolveDidCacheTtlSeconds('0')).toBe(DEFAULT_DID_CACHE_TTL_SECONDS);
    expect(resolveDidCacheTtlSeconds('-1')).toBe(DEFAULT_DID_CACHE_TTL_SECONDS);
    expect(resolveDidCacheTtlSeconds('abc')).toBe(DEFAULT_DID_CACHE_TTL_SECONDS);
  });

  it('Given invalid revalidate interval env When resolving interval Then default is used', () => {
    expect(resolveDidCacheRevalidateIntervalSeconds(undefined)).toBe(
      DEFAULT_DID_CACHE_REVALIDATE_INTERVAL_SECONDS
    );
    expect(resolveDidCacheRevalidateIntervalSeconds('0')).toBe(
      DEFAULT_DID_CACHE_REVALIDATE_INTERVAL_SECONDS
    );
    expect(resolveDidCacheRevalidateIntervalSeconds('abc')).toBe(
      DEFAULT_DID_CACHE_REVALIDATE_INTERVAL_SECONDS
    );
  });

  it('Given invalid timestamp granularity env When resolving granularity Then default is used', () => {
    expect(resolveDidCacheTimestampGranularitySeconds(undefined)).toBe(
      DEFAULT_DID_CACHE_TIMESTAMP_GRANULARITY_SECONDS
    );
    expect(resolveDidCacheTimestampGranularitySeconds('0')).toBe(
      DEFAULT_DID_CACHE_TIMESTAMP_GRANULARITY_SECONDS
    );
    expect(resolveDidCacheTimestampGranularitySeconds('abc')).toBe(
      DEFAULT_DID_CACHE_TIMESTAMP_GRANULARITY_SECONDS
    );
  });

  it('Given fresh cache and short elapsed time When resolving did document Then revalidate is skipped', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(180_000);

    const cached = new Response('{"id":"did:plc:test"}', {
      status: 200,
      headers: {
        etag: 'W/"v1"',
        [DID_CACHE_TIMESTAMP_HEADER]: '120000',
        [DID_REVALIDATED_TIMESTAMP_HEADER]: '120000',
      },
    });

    const cache = {
      match: vi.fn().mockResolvedValue(cached),
      put: vi.fn().mockResolvedValue(undefined),
    } as unknown as Cache;

    vi.stubGlobal('caches', {
      open: vi.fn().mockResolvedValue(cache),
    });

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    const waitUntil = vi.fn();
    const logger = { debug: vi.fn(), warn: vi.fn() };

    const didFetch = createDidResolverFetch(
      {
        DID_CACHE_TTL_SECONDS: '3600',
        DID_CACHE_REVALIDATE_INTERVAL_SECONDS: '120',
        DID_CACHE_TIMESTAMP_GRANULARITY_SECONDS: '60',
      } as Env,
      { waitUntil } as unknown as ExecutionContext,
      logger
    );

    const response = await didFetch('https://plc.example/did:plc:test');

    expect(response).toBe(cached);
    expect(waitUntil).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Given fresh cache and elapsed interval When resolving did document Then revalidate runs in waitUntil', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(180_000);

    const cached = new Response('{"id":"did:plc:test"}', {
      status: 200,
      headers: {
        etag: 'W/"v1"',
        [DID_CACHE_TIMESTAMP_HEADER]: '120000',
        [DID_REVALIDATED_TIMESTAMP_HEADER]: '0',
      },
    });

    const cache = {
      match: vi.fn().mockResolvedValue(cached),
      put: vi.fn().mockResolvedValue(undefined),
    } as unknown as Cache;

    vi.stubGlobal('caches', {
      open: vi.fn().mockResolvedValue(cache),
    });

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 304 }));
    vi.stubGlobal('fetch', fetchMock);

    const waitUntil = vi.fn();
    const logger = { debug: vi.fn(), warn: vi.fn() };

    const didFetch = createDidResolverFetch(
      {
        DID_CACHE_TTL_SECONDS: '3600',
        DID_CACHE_REVALIDATE_INTERVAL_SECONDS: '120',
        DID_CACHE_TIMESTAMP_GRANULARITY_SECONDS: '60',
      } as Env,
      { waitUntil } as unknown as ExecutionContext,
      logger
    );

    const response = await didFetch('https://plc.example/did:plc:test');

    expect(response).toBe(cached);
    expect(waitUntil).toHaveBeenCalledTimes(1);
    const revalidatePromise = waitUntil.mock.calls[0]?.[0] as Promise<void>;
    await revalidatePromise;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cache.put).toHaveBeenCalledTimes(1);
  });

  it('Given stale cache and 304 response When resolving did document Then cached response is returned and rounded timestamps are stored', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(123_456_789);

    const cached = new Response('{"id":"did:plc:test"}', {
      status: 200,
      headers: {
        etag: 'W/"v1"',
        [DID_CACHE_TIMESTAMP_HEADER]: '0',
        [DID_REVALIDATED_TIMESTAMP_HEADER]: '0',
      },
    });

    const cache = {
      match: vi.fn().mockResolvedValue(cached),
      put: vi.fn().mockResolvedValue(undefined),
    } as unknown as Cache;

    vi.stubGlobal('caches', {
      open: vi.fn().mockResolvedValue(cache),
    });

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 304 }));
    vi.stubGlobal('fetch', fetchMock);

    const waitUntil = vi.fn();
    const logger = { debug: vi.fn(), warn: vi.fn() };

    const didFetch = createDidResolverFetch(
      {
        DID_CACHE_TTL_SECONDS: '60',
        DID_CACHE_REVALIDATE_INTERVAL_SECONDS: '60',
        DID_CACHE_TIMESTAMP_GRANULARITY_SECONDS: '60',
      } as Env,
      { waitUntil } as unknown as ExecutionContext,
      logger
    );

    const response = await didFetch('https://plc.example/did:plc:test');

    expect(response).toBe(cached);
    expect(waitUntil).not.toHaveBeenCalled();
    expect(cache.put).toHaveBeenCalledTimes(1);

    const stamped = (cache.put as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Response;
    expect(stamped.headers.get(DID_CACHE_TIMESTAMP_HEADER)).toBe('123420000');
    expect(stamped.headers.get(DID_REVALIDATED_TIMESTAMP_HEADER)).toBe('123420000');
  });

  it('Given interval and granularity larger than ttl When resolving did document Then values are clamped and warning is logged', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(125_000);

    const cache = {
      match: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
    } as unknown as Cache;

    vi.stubGlobal('caches', {
      open: vi.fn().mockResolvedValue(cache),
    });

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{"id":"did:plc:test"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const waitUntil = vi.fn();
    const logger = { debug: vi.fn(), warn: vi.fn() };

    const didFetch = createDidResolverFetch(
      {
        DID_CACHE_TTL_SECONDS: '60',
        DID_CACHE_REVALIDATE_INTERVAL_SECONDS: '120',
        DID_CACHE_TIMESTAMP_GRANULARITY_SECONDS: '3600',
      } as Env,
      { waitUntil } as unknown as ExecutionContext,
      logger
    );

    await didFetch('https://plc.example/did:plc:test');

    expect(logger.warn).toHaveBeenCalledTimes(2);
    expect(cache.put).toHaveBeenCalledTimes(1);

    const stamped = (cache.put as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Response;
    expect(stamped.headers.get(DID_CACHE_TIMESTAMP_HEADER)).toBe('120000');
    expect(stamped.headers.get(DID_REVALIDATED_TIMESTAMP_HEADER)).toBe('120000');
  });
});
