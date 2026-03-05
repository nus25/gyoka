import { env } from 'cloudflare:test';
import { createLogger } from 'shared/src/logger';
import { describe, expect, it, vi } from 'vitest';

import { createXrpcRouter } from '../src/xrpcRouter';
import { requestPath, getRequest } from './index.shared';

const DESCRIBE_ENDPOINT = '/xrpc/app.bsky.feed.describeFeedGenerator';
const SKELETON_ENDPOINT =
  '/xrpc/app.bsky.feed.getFeedSkeleton?feed=at://did:web:example.com/app.bsky.feed.generator/feed';

describe('Error cases', () => {
  it('Given missing required env variables When describing generator Then it returns 500 internal server error', async () => {
    const spyError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const noHostResponse = await requestPath(DESCRIBE_ENDPOINT, {
      FEEDGEN_PUBLISHER_DID: env.FEEDGEN_PUBLISHER_DID,
      FEEDGEN_HOST: undefined,
      DB: env.DB,
    } as unknown as typeof env);

    expect(noHostResponse.status).toBe(500);
    expect(await noHostResponse.json()).toEqual({
      error: 'InternalServerError',
      message: 'Missing required environment variables',
    });
    const logLine1 = spyError.mock.calls[0][0] as string;
    expect(JSON.parse(logLine1)).toEqual({
      level: 'error',
      event: 'config.validation.failed',
      message: 'Missing required environment variables',
      missingVariables: ['FEEDGEN_HOST'],
    });

    spyError.mockClear();

    const noDidResponse = await requestPath(DESCRIBE_ENDPOINT, {
      FEEDGEN_PUBLISHER_DID: undefined,
      FEEDGEN_HOST: env.FEEDGEN_HOST,
      DB: env.DB,
    } as unknown as typeof env);

    expect(noDidResponse.status).toBe(500);
    expect(await noDidResponse.json()).toEqual({
      error: 'InternalServerError',
      message: 'Missing required environment variables',
    });
    const logLine2 = spyError.mock.calls[0][0] as string;
    expect(JSON.parse(logLine2)).toEqual({
      level: 'error',
      message: 'Missing required environment variables',
      event: 'config.validation.failed',
      missingVariables: ['FEEDGEN_PUBLISHER_DID'],
    });

    spyError.mockRestore();
  });

  it('Given missing DB config When describing generator Then it returns 500 internal server error', async () => {
    const response = await requestPath(DESCRIBE_ENDPOINT, {
      FEEDGEN_PUBLISHER_DID: env.FEEDGEN_PUBLISHER_DID,
      FEEDGEN_HOST: env.FEEDGEN_HOST,
      DB: undefined,
    } as unknown as typeof env);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'InternalServerError',
      message: 'Missing database configuration',
    });
  });

  it('Given invalid publisher DID format When describing generator Then it returns 500 internal server error', async () => {
    const response = await requestPath(DESCRIBE_ENDPOINT, {
      FEEDGEN_PUBLISHER_DID: 'not-a-did',
      FEEDGEN_HOST: env.FEEDGEN_HOST,
      DB: env.DB,
    } as unknown as typeof env);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'InternalServerError',
      message: 'Invalid required environment variables',
    });
  });

  it('Given invalid host format When describing generator Then it returns 500 internal server error', async () => {
    const response = await requestPath(DESCRIBE_ENDPOINT, {
      FEEDGEN_PUBLISHER_DID: env.FEEDGEN_PUBLISHER_DID,
      FEEDGEN_HOST: 'invalid_host',
      DB: env.DB,
    } as unknown as typeof env);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'InternalServerError',
      message: 'Invalid required environment variables',
    });
  });

  it('Given unexpected non-Gyoka error When describing generator Then it returns 500 internal server error', async () => {
    const response = await requestPath(DESCRIBE_ENDPOINT, {
      FEEDGEN_PUBLISHER_DID: env.FEEDGEN_PUBLISHER_DID,
      FEEDGEN_HOST: env.FEEDGEN_HOST,
      DB: {
        prepare: () => {
          throw new Error('unexpected db error');
        },
      },
    } as unknown as typeof env);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'InternalServerError',
      message: 'An unexpected error occurred.',
    });
  });

  it('Given auth required and missing authorization header When describing generator Then it returns 401 without unexpected error log', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const mockEnv = {
      ...env,
      FEEDGEN_AUTH_REQUIRED: 'enabled',
    };

    // create a new router for auth required scenario
    const router = createXrpcRouter(
      mockEnv,
      new WeakMap<Request, Env>(),
      createLogger({ service: 'generator-test', minLevel: 'debug' })
    );

    const validate = async (response) => {
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        error: 'AuthenticationRequired',
        message: 'missing authorization header',
      });

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).not.toHaveBeenCalled();

      const payload = JSON.parse(warnSpy.mock.calls[0][0] as string) as Record<string, unknown>;
      expect(payload.event).toBe('api.handle.exception.failed');
      expect(payload.errorCode).toBe('AuthenticationRequired');
      expect(payload.status).toBe(401);
      warnSpy.mockClear();
      errorSpy.mockClear();
    };
    const responseSkeleton = await router.fetch(getRequest(SKELETON_ENDPOINT));
    await validate(responseSkeleton);
    const responseDescribe = await router.fetch(getRequest(DESCRIBE_ENDPOINT));
    await validate(responseDescribe);
  });
});
