import { env } from 'cloudflare:workers';
import { describe, expect, it, vi } from 'vitest';

import { requestPath } from './index.shared';

const ENDPOINT_PATH = '/.well-known/did.json';

describe(ENDPOINT_PATH, () => {
  describe('Success cases', () => {
    it('Given developer mode When requesting the DID document Then it emits a debug success record', async () => {
      const output = vi.spyOn(console, 'log').mockImplementation(() => {});
      try {
        const response = await requestPath(ENDPOINT_PATH, undefined, {
          ...env,
          DEVELOPER_MODE: 'enabled',
        });
        expect(response.status).toBe(200);
        expect(output.mock.calls.map(([line]) => JSON.parse(String(line)))).toContainEqual(
          expect.objectContaining({ event: 'document.get.did.success', level: 'debug' })
        );
      } finally {
        output.mockRestore();
      }
    });

    it('Given valid runtime configuration When did document is requested Then did document is returned', async () => {
      const response = await requestPath(ENDPOINT_PATH);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('application/did+ld+json');
      expect(json).toEqual({
        '@context': ['https://www.w3.org/ns/did/v1'],
        id: `did:web:${env.GYOKA_EDITOR_HOST}`,
        service: [
          {
            id: '#gyoka_editor',
            type: 'GyokaEditor',
            serviceEndpoint: `https://${env.GYOKA_EDITOR_HOST}`,
          },
        ],
      });
    });
  });
});
