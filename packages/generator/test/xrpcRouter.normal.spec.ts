import { createLogger } from 'shared/src/logger';
import { describe, it, expect, vi } from 'vitest';

import { sanitizeAtcuteValidationResponse } from '../src/xrpcRouter';

describe('Success cases', () => {
  it('Given validation issues containing input data When sanitizing the response Then logs only the issue count', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const logger = createLogger({ service: 'test', minLevel: 'debug' });
    const response = new Response(
      JSON.stringify({
        error: 'InvalidRequest',
        message: 'private value',
        'net.kelinci.atcute.issues': [{ path: 'foo', message: 'private value' }],
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
      issueCount: 1,
    });
    expect(result.status).toBe(400);
    expect(result.headers.get('content-length')).toBeNull();
    const body = await result.json();
    expect(body).toEqual({ error: 'BadRequest', message: 'private value' });
    warnSpy.mockRestore();
  });
});
