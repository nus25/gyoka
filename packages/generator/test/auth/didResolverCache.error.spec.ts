import { describe, it, expect } from 'vitest';

import {
  DEFAULT_DID_CACHE_TTL_SECONDS,
  resolveDidCacheTtlSeconds,
} from '../../src/auth/didResolverFetch';

describe('Error case', () => {
  it('Given undefined ttl env When resolving ttl Then default 1 day is used', () => {
    expect(resolveDidCacheTtlSeconds(undefined)).toBe(DEFAULT_DID_CACHE_TTL_SECONDS);
  });

  it('Given invalid ttl env When resolving ttl Then default 1 day is used', () => {
    expect(resolveDidCacheTtlSeconds('0')).toBe(DEFAULT_DID_CACHE_TTL_SECONDS);
    expect(resolveDidCacheTtlSeconds('-1')).toBe(DEFAULT_DID_CACHE_TTL_SECONDS);
    expect(resolveDidCacheTtlSeconds('abc')).toBe(DEFAULT_DID_CACHE_TTL_SECONDS);
  });
});
