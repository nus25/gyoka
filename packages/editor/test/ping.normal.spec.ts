import { describe, expect, it, vi } from 'vitest';

import { ENDPOINT_PATH, ping } from './ping.shared';

describe(ENDPOINT_PATH, () => {
  describe('Success cases', () => {
    it('Given developer mode When ping is called Then it emits a debug success record', async () => {
      const output = vi.spyOn(console, 'log').mockImplementation(() => {});
      try {
        const { response } = await ping({ envOverrides: { DEVELOPER_MODE: 'enabled' } });
        expect(response.status).toBe(200);
        expect(output.mock.calls.map(([line]) => JSON.parse(String(line)))).toContainEqual(
          expect.objectContaining({ event: 'api.ping.service.success', level: 'debug' })
        );
      } finally {
        output.mockRestore();
      }
    });

    it('Given auth is disabled When ping is called Then pong message is returned', async () => {
      const { response, json } = await ping();

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('application/json');
      expect(json).toEqual({
        message: 'Gyoka is available',
      });
    });
  });
});
