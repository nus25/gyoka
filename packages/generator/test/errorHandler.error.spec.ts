import { XRPCError } from '@atcute/xrpc-server';
import { createLogger } from 'shared/src/logger';
import { describe, it, expect, vi } from 'vitest';

import { handleAppError } from '../src/errorHandler';

describe('Error case', () => {
  it('Given an unexpected error containing private input When handling it Then logs the error type without its message', () => {
    const output = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = handleAppError(new Error('private input'), false, createLogger({}), {
        operation: 'test',
        stage: 'read',
      });
      expect(response.status).toBe(500);
      const record = JSON.parse(String(output.mock.calls[0][0]));
      expect(record).toMatchObject({ errorName: 'Error', operation: 'test', stage: 'read' });
      expect(JSON.stringify(record)).not.toContain('private input');
    } finally {
      output.mockRestore();
    }
  });

  it('Given XRPCError with status 500 and devMode false When handleAppError is called Then logs error with stack', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = createLogger({ service: 'test', minLevel: 'debug' });
    const err = new XRPCError({
      status: 500,
      error: 'InternalServerError',
      message: 'stacktrace',
    });
    const response = handleAppError(err, false, logger);
    const logLine = errorSpy.mock.calls[0][0] as string;
    expect(JSON.parse(logLine)).toEqual({
      level: 'error',
      event: 'api.handle.exception.failed',
      errorCode: 'InternalServerError',
      status: 500,
      message: 'stacktrace',
      stack: undefined, // stack is not included in the log when devMode is false
    });
    expect(response.status).toBe(500);
  });
});
