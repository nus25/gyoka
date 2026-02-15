import { describe, expect, it } from 'vitest';

import {
  BadRequestError,
  ConflictError,
  GyokaBaseError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
  UnknownFeedError,
  createErrorResponse,
} from '../src/errors';

describe('Success cases', () => {
  it('Given createErrorResponse input When response is created Then status and json body are set', async () => {
    const response = createErrorResponse('BadRequest', 'validation failed', 400);

    expect(response.status).toBe(400);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(await response.json()).toEqual({
      error: 'BadRequest',
      message: 'validation failed',
    });
  });

  it('Given GyokaBaseError message When instance is created Then default code and status are set', () => {
    const error = new GyokaBaseError('base error');

    expect(error.message).toBe('base error');
    expect(error.errorCode).toBe('GyokaBaseError');
    expect(error.status).toBe(500);
  });

  it('Given domain error classes When instances are created Then each code and status are correct', () => {
    const internalServerError = new InternalServerError('internal');
    const notFoundError = new NotFoundError('not found');
    const badRequestError = new BadRequestError('bad request');
    const unknownFeedError = new UnknownFeedError('unknown feed');
    const unauthorizedError = new UnauthorizedError('unauthorized');
    const conflictError = new ConflictError('conflict');

    expect(internalServerError.errorCode).toBe('InternalServerError');
    expect(internalServerError.status).toBe(500);

    expect(notFoundError.errorCode).toBe('NotFound');
    expect(notFoundError.status).toBe(404);

    expect(badRequestError.errorCode).toBe('BadRequest');
    expect(badRequestError.status).toBe(400);

    expect(unknownFeedError.errorCode).toBe('UnknownFeed');
    expect(unknownFeedError.status).toBe(404);

    expect(unauthorizedError.errorCode).toBe('Unauthorized');
    expect(unauthorizedError.status).toBe(401);

    expect(conflictError.errorCode).toBe('Conflict');
    expect(conflictError.status).toBe(409);
  });

  it('Given each error class schema When schema is built Then expected response status keys exist', () => {
    expect(InternalServerError.schema()).toHaveProperty('500');
    expect(NotFoundError.schema()).toHaveProperty('404');
    expect(BadRequestError.schema()).toHaveProperty('400');
    expect(UnknownFeedError.schema()).toHaveProperty('404');
    expect(UnauthorizedError.schema()).toHaveProperty('401');
    expect(ConflictError.schema()).toHaveProperty('409');
  });
});
