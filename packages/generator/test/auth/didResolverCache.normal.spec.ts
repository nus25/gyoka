import { describe, it, vi, expect } from 'vitest';
import { createDidResolverFetch, resolveDidCacheTtlSeconds } from '../../src/auth/didResolverFetch';
import { createLogger } from 'shared/src/logger';

describe('Success case', () => {
  it('Given a valid DID, when the resolver cache is accessed, then it should send a request with cf cache headers', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const logger = createLogger({ service: 'test' });
    const cachedFetch = createDidResolverFetch(17, logger);
    const did = 'did:plc:123456789abcdefghi';
    const url = new URL(`https://plc.directory/${did}`);

    const expectedHeaders = {
      cf: {
        cacheEverything: true,
        cacheTtlByStatus: {
          '200-299': 17,
          '404': 1,
          '500-599': 0,
        },
      },
    };

    await cachedFetch(url, null);
    // check if fetch was called with the correct parameters
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const req = fetchSpy.mock.calls[0][0] as Request;
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(req.url).toBe(url.toString());
    expect(req.headers.get('accept')).toBe('application/did+ld+json');
    expect(init).toEqual(expectedHeaders);
    fetchSpy.mockRestore();
  });

  it('Given a valid DID and no-cache header, when the resolver cache is accessed, then it should request without cf cache header', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const logger = createLogger({ service: 'test' });
    const cachedFetch = createDidResolverFetch(17, logger);
    const did = 'did:plc:123456789abcdefghi';
    const url = new URL(`https://plc.directory/${did}`);

    await cachedFetch(url, { cache: 'no-cache' });
    // check if fetch was called with the correct parameters
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const req = fetchSpy.mock.calls[0][0] as Request;
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(req.url).toBe(url.toString());
    expect(req.headers.get('accept')).toBe('application/did+ld+json');
    expect(req.cache).toBe('no-cache');
    expect(init).toEqual(undefined);
    fetchSpy.mockRestore();
  });

  it('Given valid ttl env When resolving ttl Then configured value is used', () => {
    expect(resolveDidCacheTtlSeconds('600')).toBe(600);
  });
});
