import { XRPCError } from '@atcute/xrpc-server';
import { createErrorResponse, GyokaBaseError } from 'shared/src/errors/core';
import { Logger } from 'shared/src/logger';

export function handleAppError(error: unknown, devMode: boolean, logger: Logger): Response {
  if (error instanceof XRPCError) {
    const level = error.status >= 500 ? 'error' : 'warn';
    const details: Record<string, unknown> = {
      errorCode: error.error,
      status: error.status,
      message: error.message,
    };

    if (devMode) {
      details.stack = error.stack;
    }

    logger[level]('api.handle.exception.failed', details);
    return error.toResponse();
  }

  if (error instanceof GyokaBaseError) {
    const level = error.status >= 500 ? 'error' : 'warn';
    const details: Record<string, unknown> = {
      errorCode: error.errorCode,
      status: error.status,
      message: error.message,
    };

    if (devMode) {
      details.stack = error.stack;
    }

    logger[level]('api.handle.exception.failed', details);
    return createErrorResponse(error.errorCode, error.message, error.status);
  }

  logger.error('api.handle.unexpected.failed', { error });
  return createErrorResponse('InternalServerError', 'An unexpected error occurred.', 500);
}
