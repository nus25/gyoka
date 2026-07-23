import { InternalServerError } from 'shared/src/errors/core';
import { createLogger, type Logger } from 'shared/src/logger';

import { handleAppError } from './errorHandler';
import {
  createXrpcRouter,
  sanitizeAtcuteValidationResponse,
  type XrpcRuntimeConfig,
} from './xrpcRouter';

const envMap = new WeakMap<Request, Env>();
const loggerCache = new Map<string, Logger>();
const routerCache = new Map<string, ReturnType<typeof createXrpcRouter>>();

function assertRequiredConfiguration(
  env: Env,
  authRequired: boolean,
  logger: ReturnType<typeof createLogger>
) {
  if (!env.DB) {
    logger.error('config.validation.failed', {
      message: 'Missing database configuration',
    });
    throw new InternalServerError('Missing database configuration');
  }

  if (!env.GYOKA_EDITOR_HOST) {
    logger.error('config.validation.failed', {
      message: 'Missing required environment variables',
      missingVariables: ['GYOKA_EDITOR_HOST'],
    });
    throw new InternalServerError('Missing required environment variables');
  }

  if (authRequired && !env.GYOKA_EDITOR_ADMIN_DIDS) {
    logger.error('config.validation.failed', {
      message: 'Missing required environment variables',
      missingVariables: ['GYOKA_EDITOR_ADMIN_DIDS'],
    });
    throw new InternalServerError('Missing required environment variables');
  }
}

function createRuntimeConfig(env: Env): XrpcRuntimeConfig {
  return {
    isDevMode: env.DEVELOPER_MODE === 'enabled',
    requiredAuth: env.GYOKA_EDITOR_AUTH_REQUIRED !== 'disabled',
    host: env.GYOKA_EDITOR_HOST,
    adminDids: env.GYOKA_EDITOR_ADMIN_DIDS,
    ttlSeconds: env.DID_CACHE_TTL_SECONDS
      ? Number.parseInt(env.DID_CACHE_TTL_SECONDS, 10)
      : Number.NaN,
  };
}

function createRuntimeKey(config: XrpcRuntimeConfig): string {
  return JSON.stringify({
    isDevMode: config.isDevMode,
    requiredAuth: config.requiredAuth,
    host: config.host,
    adminDids: config.adminDids,
    ttlSeconds: config.ttlSeconds,
  });
}

function getLogger(config: XrpcRuntimeConfig): Logger {
  const loggerKey = config.isDevMode ? 'editor-atproto:debug' : 'editor-atproto:info';
  const cached = loggerCache.get(loggerKey);
  if (cached) {
    return cached;
  }

  const logger = createLogger({
    service: 'editor-atproto',
    minLevel: config.isDevMode ? 'debug' : 'info',
  });
  loggerCache.set(loggerKey, logger);
  return logger;
}

function getRouter(config: XrpcRuntimeConfig, logger: Logger) {
  const runtimeKey = createRuntimeKey(config);
  const cached = routerCache.get(runtimeKey);
  if (cached) {
    return cached;
  }

  const router = createXrpcRouter(config, envMap, logger);
  routerCache.set(runtimeKey, router);
  return router;
}

const app = {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const config = createRuntimeConfig(env);
    const logger = getLogger(config);

    try {
      assertRequiredConfiguration(env, config.requiredAuth, logger);

      envMap.set(request, env);
      const router = getRouter(config, logger);
      const response = await router.fetch(request);
      return await sanitizeAtcuteValidationResponse(response, logger);
    } catch (error) {
      return handleAppError(error, config.isDevMode, logger);
    }
  },
};

export default app;
