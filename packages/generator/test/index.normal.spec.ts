import { describe, expect, it } from 'vitest';

import { requestPath } from './index.shared';

describe('Success cases', () => {
  it('Given /docs route in production mode When requested Then it returns 404', async () => {
    const response = await requestPath('/docs');
    expect(response.status).toBe(404);
  });

  it('Given /redocs route in production mode When requested Then it returns 404', async () => {
    const response = await requestPath('/redocs');
    expect(response.status).toBe(404);
  });

  it('Given /openapi.json route in production mode When requested Then it returns 404', async () => {
    const response = await requestPath('/openapi.json');
    expect(response.status).toBe(404);
  });
});
