import { createLogger } from 'shared/src/logger';
import { describe, it, expect, vi } from 'vitest';

import { sanitizeAtcuteValidationResponse } from '../src/xrpcRouter';

describe('Success cases', () => {
  it('Given status is 400, content-type is json, error is InvalidRequest, and issues is present When sanitizeAtcuteValidationResponse is called Then sanitizes response and logs issues', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const logger = createLogger({ service: 'test', minLevel: 'debug' });
    const response = new Response(
      JSON.stringify({
        error: 'InvalidRequest',
        message: 'msg',
        'net.kelinci.atcute.issues': [{ path: 'foo', message: 'bar' }],
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'content-length': '999' },
      }
    );
    const result = await sanitizeAtcuteValidationResponse(response, logger);
    expect(result).not.toBe(response);
    const logLine = warnSpy.mock.calls[0][0] as string;
    expect(JSON.parse(logLine)).toEqual({
      level: 'warn',
      event: 'api.validate.request.failed',
      status: 400,
      errorCode: 'BadRequest',
      message: 'msg',
      issues: [{ path: 'foo', message: 'bar' }],
    });
    expect(result.status).toBe(400);
    expect(result.headers.get('content-length')).toBeNull();
    const body = await result.json();
    expect(body).toEqual({ error: 'BadRequest', message: 'msg' });
    warnSpy.mockRestore();
  });
});
