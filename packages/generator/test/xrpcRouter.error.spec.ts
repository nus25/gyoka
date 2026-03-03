import { describe, it, expect, vi } from 'vitest';
import { sanitizeAtcuteValidationResponse } from '../src/xrpcRouter';
import { createLogger } from 'shared/src/logger';

describe('Error cases', () => {
  it('Given status is not 400 When sanitizeAtcuteValidationResponse is called Then returns original response', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logger = createLogger({ service: 'test', minLevel: 'debug' });
    const response = new Response('ok', { status: 200 });
    const result = await sanitizeAtcuteValidationResponse(response, logger);
    expect(result).toBe(response);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('Given content-type is not json When sanitizeAtcuteValidationResponse is called Then returns original response', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logger = createLogger({ service: 'test', minLevel: 'debug' });
    const response = new Response('err', {
      status: 400,
      headers: { 'Content-Type': 'text/plain' },
    });
    const result = await sanitizeAtcuteValidationResponse(response, logger);
    expect(result).toBe(response);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('Given payload is not json When sanitizeAtcuteValidationResponse is called Then returns original response', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logger = createLogger({ service: 'test', minLevel: 'debug' });
    const response = new Response('not-json', {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
    const result = await sanitizeAtcuteValidationResponse(response, logger);
    expect(result).toBe(response);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('Given error is not InvalidRequest When sanitizeAtcuteValidationResponse is called Then returns original response', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logger = createLogger({ service: 'test', minLevel: 'debug' });
    const response = new Response(JSON.stringify({ error: 'OtherError' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
    const result = await sanitizeAtcuteValidationResponse(response, logger);
    expect(result).toBe(response);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('Given issues is undefined When sanitizeAtcuteValidationResponse is called Then returns original response', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logger = createLogger({ service: 'test', minLevel: 'debug' });
    const response = new Response(JSON.stringify({ error: 'InvalidRequest', message: 'msg' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
    const result = await sanitizeAtcuteValidationResponse(response, logger);
    expect(result).toBe(response);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
