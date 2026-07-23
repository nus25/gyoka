import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDidDocumentFetch, createServiceJwtToken } from './authJwt.shared';
import { ENDPOINT_PATH, ping } from './ping.shared';

const HOST = 'com.example.host';
const LXM = 'net.nusno.gyoka.ping';

describe(ENDPOINT_PATH, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Auth with real JWT', () => {
    it('Given auth is enabled and caller DID is in admin allowlist When ping is called with valid service JWT Then success is returned', async () => {
      const issuer = 'did:plc:12345qq5tlnx4f5qvtpntest';
      const { token, publicKey } = await createServiceJwtToken({
        issuer,
        audience: `did:web:${HOST}`,
        lxm: LXM,
      });

      vi.spyOn(globalThis, 'fetch').mockImplementation(createDidDocumentFetch(issuer, publicKey));

      const { response, json } = await ping({
        envOverrides: {
          GYOKA_EDITOR_AUTH_REQUIRED: 'enabled',
          GYOKA_EDITOR_HOST: HOST,
          GYOKA_EDITOR_ADMIN_DIDS: issuer,
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.status).toBe(200);
      expect(json).toEqual({
        message: 'Gyoka is available',
      });
    });

    it('Given auth is enabled and caller DID is not in admin allowlist When ping is called with valid service JWT Then forbidden is returned', async () => {
      const issuer = 'did:plc:12345qq5tlnx4f5qvtpntest';
      const { token, publicKey } = await createServiceJwtToken({
        issuer,
        audience: `did:web:${HOST}`,
        lxm: LXM,
      });

      vi.spyOn(globalThis, 'fetch').mockImplementation(createDidDocumentFetch(issuer, publicKey));

      const { response, json } = await ping({
        envOverrides: {
          GYOKA_EDITOR_AUTH_REQUIRED: 'enabled',
          GYOKA_EDITOR_HOST: HOST,
          GYOKA_EDITOR_ADMIN_DIDS: 'did:plc:notallowed00000000000000000000000',
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.status).toBe(403);
      expect(json).toEqual({
        error: 'Forbidden',
        message: 'Caller is not allowed to access this service',
      });
    });
  });
});
