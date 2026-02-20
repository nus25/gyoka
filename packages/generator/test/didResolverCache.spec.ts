import { describe, expect, it } from 'vitest';

import {
  DEFAULT_DID_CACHE_TTL_SECONDS,
  resolveDidCacheTtlSeconds,
} from '../src/auth/didResolverCache';

describe('didResolverCache', () => {
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
});
