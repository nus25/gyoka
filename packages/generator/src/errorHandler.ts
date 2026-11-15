import { XRPCError } from '@atcute/xrpc-server';
import { createErrorResponse } from 'shared/src/errors/core';
import { GyokaBaseError } from 'shared/src/errors/core';
import { Logger } from 'shared/src/logger';

export function handleAppError(
  err: unknown,
  devMode: boolean,
  logger: Logger,
  context: Record<string, unknown> = {}
): Response {
  if (err instanceof XRPCError) {
    const level = err.status >= 500 ? 'error' : 'warn';
    const details: Record<string, unknown> = {
      ...context,
      errorCode: err.error,
      status: err.status,
      message: err.message,
    };

    if (devMode) {
      details.stack = err.stack;
    }

    logger[level]('api.handle.exception.failed', details);
    return err.toResponse();
  }

  if (err instanceof GyokaBaseError) {
    const level = err.status >= 500 ? 'error' : 'warn';
    const details: Record<string, unknown> = {
      ...context,
      errorCode: err.errorCode,
      status: err.status,
      message: err.message,
    };

    if (devMode) {
      details.stack = err.stack;
    }

    logger[level]('api.handle.exception.failed', details);
    return createErrorResponse(err.errorCode, err.message, err.status);
  }

  logger.error('api.handle.unexpected.failed', {
    ...context,
    errorName: err instanceof Error ? err.name : 'UnknownError',
  });
  return createErrorResponse('InternalServerError', 'An unexpected error occurred.', 500);
}
