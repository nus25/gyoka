const DID_RESOLVER_CACHE_NAME = 'did-resolver-cache';
const DID_CACHE_TIMESTAMP_HEADER = 'x-gyoka-did-cached-at';
export const DEFAULT_DID_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;

type CacheLogger = {
  debug: (event: string, details?: Record<string, unknown>) => void;
  warn: (event: string, details?: Record<string, unknown>) => void;
};

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

function createCacheKey(request: Request): Request {
  return new Request(request.url, {
    method: 'GET',
    headers: {
      accept: 'application/did+json',
    },
  });
}

function stampCachedResponse(response: Response, cachedAt: number): Response {
  const headers = new Headers(response.headers);
  headers.set(DID_CACHE_TIMESTAMP_HEADER, String(cachedAt));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isFresh(cached: Response, ttlSeconds: number, now: number): boolean {
  const cachedAtRaw = cached.headers.get(DID_CACHE_TIMESTAMP_HEADER);
  if (!cachedAtRaw) {
    return false;
  }

  const cachedAt = Number.parseInt(cachedAtRaw, 10);
  if (!Number.isFinite(cachedAt)) {
    return false;
  }

  return now - cachedAt <= ttlSeconds * 1000;
}

async function revalidate(
  cacheKey: Request,
  cached: Response,
  cache: Cache,
  logger: CacheLogger
): Promise<void> {
  const etag = cached.headers.get('etag');
  if (!etag) {
    return;
  }

  logger.debug('auth.revalidate.didcache.start', {
    url: cacheKey.url,
  });

  try {
    const headers = new Headers(cacheKey.headers);
    headers.set('If-None-Match', etag);

    const response = await fetch(cacheKey.url, {
      method: 'GET',
      headers,
      cache: 'no-cache',
    });

    if (response.status === 200) {
      await cache.put(cacheKey, stampCachedResponse(response.clone(), Date.now()));
      logger.debug('auth.revalidate.didcache.success', {
        url: cacheKey.url,
        updated: true,
      });
      return;
    }

    if (response.status === 304) {
      // 304 Not Modified - update the cached timestamp without changing the content
      await cache.put(cacheKey, stampCachedResponse(cached.clone(), Date.now()));
      logger.debug('auth.revalidate.didcache.success', {
        url: cacheKey.url,
        updated: false,
        refreshed: true,
      });
      return;
    }

    logger.warn('auth.revalidate.didcache.failed', {
      url: cacheKey.url,
      status: response.status,
    });
  } catch (error) {
    logger.warn('auth.revalidate.didcache.failed', {
      url: cacheKey.url,
      error,
    });
  }
}

export function createDidResolverFetch(
  env: Env,
  ctx: ExecutionContext,
  logger: CacheLogger
): DidResolverFetch {
  return async (input, init) => {
    const ttlSeconds = resolveDidCacheTtlSeconds(env.DID_CACHE_TTL_SECONDS);
    const request = new Request(input, init);
    request.headers.set('accept', 'application/did+json');

    const bypassCache = init?.cache === 'no-cache' || request.cache === 'no-cache';
    const cacheKey = createCacheKey(request);

    if (bypassCache) {
      logger.debug('auth.resolve.didcache.success', {
        url: cacheKey.url,
        cache: 'bypass',
      });
      return fetch(request);
    }

    const cache = await caches.open(DID_RESOLVER_CACHE_NAME);
    const cached = await cache.match(cacheKey);

    if (cached && isFresh(cached, ttlSeconds, Date.now())) {
      logger.debug('auth.resolve.didcache.success', {
        url: cacheKey.url,
        cache: 'hit',
      });
      ctx.waitUntil(revalidate(cacheKey, cached, cache, logger));
      return cached;
    }

    logger.debug('auth.resolve.didcache.success', {
      url: cacheKey.url,
      cache: cached ? 'stale' : 'miss',
      ttlSeconds,
    });

    // stale - fetch with etag
    if (cached) {
      const etag = cached.headers.get('etag');
      if (etag) {
        const headers = new Headers(request.headers);
        headers.set('If-None-Match', etag);
        const conditionalReq = new Request(request.url, {
          method: 'GET',
          headers,
          cache: 'no-cache',
        });
        const response = await fetch(conditionalReq);
        if (response.status === 304) {
          // Not Modified - update the cached timestamp without changing the content
          await cache.put(cacheKey, stampCachedResponse(cached.clone(), Date.now()));
          logger.debug('auth.resolve.didcache.success', {
            url: cacheKey.url,
            cache: 'refreshed',
            refreshed: true,
          });
          return cached;
        }
        if (response.ok && response.status === 200) {
          await cache.put(cacheKey, stampCachedResponse(response.clone(), Date.now()));
          return response;
        }
        // fallthrough for other statuses
      }
    }

    // normal fetch
    const response = await fetch(request);
    if (response.ok && response.status === 200) {
      ctx.waitUntil(cache.put(cacheKey, stampCachedResponse(response.clone(), Date.now())));
    }
    return response;
  };
}
