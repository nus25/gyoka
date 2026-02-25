import { Logger } from "shared/src/logger";

export const DEFAULT_DID_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;

type DidResolverFetch = (
  input: URL | RequestInfo<unknown, CfProperties<unknown>>,
  init?: RequestInit<RequestInitCfProperties>
) => Promise<Response>;

export function resolveDidCacheTtlSeconds(ttlSecondsRaw?: string): number {
  if (!ttlSecondsRaw) {
    return DEFAULT_DID_CACHE_TTL_SECONDS;
  }
  const parsed = Number.parseInt(ttlSecondsRaw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_DID_CACHE_TTL_SECONDS;
  }
  return parsed;
}
  
export function createDidResolverFetch(ttlSeconds: number, logger: Logger): DidResolverFetch {
  
  return async (input, init) => {
    const request = new Request(input, init);
    request.headers.set('accept', 'application/did+ld+json');

    const bypassCache = init?.cache === 'no-cache' || request.cache === 'no-cache';

    if (bypassCache) {
      const response = await fetch(request);      // force bypass cache with no-cache directive
      logger.debug('auth.resolve.didcache.fetch', {
        url: request.url,
        cache: 'bypass',
      });
      return response;
    } else {
      // fetch with cache directives to leverage Cloudflare's edge caching
      const response = await fetch(request, {
        cf: {
          cacheTtlByStatus: { '200-299': ttlSeconds, 404: 1, '500-599': 0 },
          cacheEverything: true,
        },
      });
      logger.debug('auth.resolve.didcache.fetch', {
        url: request.url,
        status: response.status,
        fromCache: response.headers.get('cf-cache-status') === 'HIT',
      });
      return response;
    }
  };
}
