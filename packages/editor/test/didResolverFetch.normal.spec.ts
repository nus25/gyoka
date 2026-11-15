import type { Logger } from 'shared/src/logger';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_DID_CACHE_TTL_SECONDS,
  createDidResolverFetch,
  resolveDidCacheTtlSeconds,
} from '../src/auth/didResolverFetch';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resolveDidCacheTtlSeconds', () => {
  it('Given the TTL setting is omitted When it is resolved Then the default TTL is returned', () => {
    expect(resolveDidCacheTtlSeconds()).toBe(DEFAULT_DID_CACHE_TTL_SECONDS);
  });

  it('Given the TTL setting is empty When it is resolved Then the default TTL is returned', () => {
    expect(resolveDidCacheTtlSeconds('')).toBe(DEFAULT_DID_CACHE_TTL_SECONDS);
  });

  it('Given the TTL setting is not numeric When it is resolved Then the default TTL is returned', () => {
    expect(resolveDidCacheTtlSeconds('invalid')).toBe(DEFAULT_DID_CACHE_TTL_SECONDS);
  });

  it('Given the TTL setting is zero or negative When it is resolved Then the default TTL is returned', () => {
    expect(resolveDidCacheTtlSeconds('0')).toBe(DEFAULT_DID_CACHE_TTL_SECONDS);
    expect(resolveDidCacheTtlSeconds('-10')).toBe(DEFAULT_DID_CACHE_TTL_SECONDS);
  });

  it('Given the TTL setting is a positive integer When it is resolved Then that TTL is returned', () => {
    expect(resolveDidCacheTtlSeconds('3600')).toBe(3600);
  });
});

describe('createDidResolverFetch', () => {
  it('Given cache bypass succeeds When DID resolver fetch completes Then debug log includes cache bypass', async () => {
    const debug = vi.fn();
    const logger: Logger = {
      debug,
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));

    await createDidResolverFetch(60, logger)('https://plc.directory/did:plc:example', {
      cache: 'no-cache',
    });

    expect(debug).toHaveBeenCalledWith('auth.resolve.didcache.fetch', {
      url: 'https://plc.directory/did:plc:example',
      cache: 'bypass',
    });
  });
});
