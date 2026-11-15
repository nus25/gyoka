import type { Logger } from 'shared/src/logger';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDidResolverFetch } from '../src/auth/didResolverFetch';

function createLogger(): Logger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('createDidResolverFetch error cases', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Given an invalid request URL When DID resolver fetch is called Then request construction error is propagated', async () => {
    const didResolverFetch = createDidResolverFetch(60, createLogger());

    await expect(didResolverFetch('://invalid-url')).rejects.toBeInstanceOf(TypeError);
  });

  it('Given fetch rejects When cached DID resolver fetch is called Then fetch error is propagated', async () => {
    const fetchError = new Error('network unavailable');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(fetchError);
    const didResolverFetch = createDidResolverFetch(60, createLogger());

    await expect(didResolverFetch('https://plc.directory/did:plc:example')).rejects.toBe(
      fetchError
    );
  });

  it('Given fetch rejects When cache bypass is requested Then fetch error is propagated', async () => {
    const fetchError = new Error('network unavailable');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(fetchError);
    const didResolverFetch = createDidResolverFetch(60, createLogger());

    await expect(
      didResolverFetch('https://plc.directory/did:plc:example', { cache: 'no-cache' })
    ).rejects.toBe(fetchError);
  });
});
