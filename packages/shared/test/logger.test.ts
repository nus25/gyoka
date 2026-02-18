import { afterEach, describe, expect, it, vi } from 'vitest';

import { createLogger } from '../src/logger';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Success cases', () => {
  it('Given logger info call When logging Then compact JSON log line is written', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger({ service: 'shared' });

    logger.info('test.event', { requestId: 'req-1' });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = logSpy.mock.calls[0][0] as string;
    const payload = JSON.parse(line) as Record<string, unknown>;
    expect(payload.level).toBe('info');
    expect(payload.event).toBe('test.event');
    expect(payload.requestId).toBe('req-1');
    expect(payload.service).toBeUndefined();
    expect(payload.timestamp).toBeUndefined();
  });

  it('Given include flags When logging Then service and timestamp are emitted', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger({
      service: 'shared',
      includeService: true,
      includeTimestamp: true,
    });

    logger.info('test.event');

    const line = logSpy.mock.calls[0][0] as string;
    const payload = JSON.parse(line) as Record<string, unknown>;
    expect(payload.service).toBe('shared');
    expect(payload.timestamp).toBeTypeOf('string');
  });

  it('Given sensitive values When logging Then values are redacted', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger({ service: 'shared' });

    logger.info('test.redact', {
      token: 'secret-token',
      nested: {
        authorization: 'Bearer dummy',
      },
    });

    const line = logSpy.mock.calls[0][0] as string;
    const payload = JSON.parse(line) as Record<string, unknown>;
    const nested = payload.nested as Record<string, unknown>;

    expect(payload.token).toBe('[REDACTED]');
    expect(nested.authorization).toBe('[REDACTED]');
  });

  it('Given minLevel info When debug log is called Then debug is not emitted', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createLogger({ service: 'shared', minLevel: 'info' });

    logger.debug('test.debug', { x: 1 });

    expect(logSpy).not.toHaveBeenCalled();
  });

  it('Given error value in details When logging Then error is normalized', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = createLogger({ service: 'shared' });

    logger.error('test.error', {
      err: new Error('boom'),
    });

    const line = errorSpy.mock.calls[0][0] as string;
    const payload = JSON.parse(line) as Record<string, unknown>;
    const err = payload.err as Record<string, unknown>;

    expect(payload.level).toBe('error');
    expect(err.name).toBe('Error');
    expect(err.message).toBe('boom');
    expect(typeof err.stack).toBe('string');
  });
});
