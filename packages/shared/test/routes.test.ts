import { describe, expect, it } from 'vitest';
import * as z from 'zod';

import { ErrorResponse } from '../src/errors';
import { BaseOpenAPIRoute } from '../src/routes';

class TestRoute extends BaseOpenAPIRoute {
  constructor() {
    super({
      router: {},
      raiseUnknownParameters: false,
      route: '/test',
      urlParams: [],
    });
  }

  public getValidationErrorPayload(errors: z.core.$ZodIssue[]) {
    return this.buildValidationErrorPayload(errors);
  }
}

describe('Success cases', () => {
  it('Given zod issues When payload is built Then messages and paths are mapped', () => {
    const result = z.string().min(5).safeParse('abc');
    expect(result.success).toBe(false);

    const route = new TestRoute();
    const payload = route.getValidationErrorPayload(result.error.issues);

    expect(payload).toHaveLength(1);
    expect(payload[0].message).toBeDefined();
    expect(payload[0].path).toEqual([]);
  });

  it('Given zod issues When handleValidationError is called Then bad request response is returned', async () => {
    const result = z.object({ feed: z.string().min(3) }).safeParse({ feed: 'a' });
    expect(result.success).toBe(false);

    const route = new TestRoute();
    const response = route.handleValidationError(result.error.issues);

    expect(response.status).toBe(400);
    expect(response.headers.get('Content-Type')).toBe('application/json');

    const body = (await response.json()) as ErrorResponse;
    expect(body.error).toBe('BadRequest');
    expect(body.message).toContain('Too small: expected string to have >=3 characters');
  });
});
