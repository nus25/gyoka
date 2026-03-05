import { Secp256k1PrivateKeyExportable } from '@atcute/crypto';
import { createServiceJwt, CreateServiceJwtOptions } from '@atcute/xrpc-server/auth';
import { createLogger } from 'shared/src/logger';
import { describe, it, vi, expect } from 'vitest';

import { createRequireAuth } from '../../src/auth/createRequireAuth';
import { createDidDocumentFetch } from './createRequireAuth.shared';

describe('Error case', () => {
  it('Given requiredAuth=true, When no authorization header Then throws missing authorization header', async () => {
    const logger = createLogger({ service: 'test', minLevel: 'debug' });
    const requireAuth = createRequireAuth(true, 'com.example.host', 60, logger);
    const req = new Request('http://localhost');
    await expect(requireAuth(req, 'com.example.test')).rejects.toMatchObject({
      message: expect.stringContaining('missing authorization header'),
    });
  });

  it('Given requiredAuth=true, When authorization header is not Bearer Then throws invalid authorization scheme', async () => {
    const logger = createLogger({ service: 'test', minLevel: 'debug' });
    const requireAuth = createRequireAuth(true, 'com.example.host', 60, logger);
    const req = new Request('http://localhost', {
      headers: { Authorization: 'Basic abcdef' },
    });
    await expect(requireAuth(req, 'com.example.test')).rejects.toMatchObject({
      message: expect.stringContaining('invalid authorization scheme'),
    });
  });

  it('Given requiredAuth=true, Bearer token, but Invalid JWT When called Then throws AuthRequiredError', async () => {
    const logger = createLogger({ service: 'test', minLevel: 'debug' });
    const requireAuth = createRequireAuth(true, 'com.example.host', 60, logger);
    const keypair = await Secp256k1PrivateKeyExportable.createKeypair();
    let pub = await keypair.exportPublicKey('multikey');
    pub = pub.slice(0, -4) + 'test';
    const fetchSpy = vi.fn(createDidDocumentFetch(pub));
    vi.stubGlobal('fetch', fetchSpy);
    const now = Math.floor(Date.now() / 1_000);
    const option = {
      keypair: keypair,
      issuer: 'did:plc:12345qq5tlnx4f5qvtpntest',
      audience: 'did:web:com.example.host',
      lxm: 'com.example.test',
      issuedAt: now,
      expiresIn: 60,
    } as CreateServiceJwtOptions;
    const token = await createServiceJwt(option);
    const req = new Request('http://com.example.host', {
      headers: { Authorization: `Bearer ${token}` },
    });
    await expect(requireAuth(req, 'com.example.test')).rejects.toBeDefined();
    fetchSpy.mockRestore();
  });

  it('Given requiredAuth=true, Bearer token, but JWT with invalid aud/iss/lxm When called Then throws AuthRequiredError', async () => {
    const logger = createLogger({ service: 'test', minLevel: 'debug' });
    const requireAuth = createRequireAuth(true, 'com.example.host', 60, logger);
    const keypair = await Secp256k1PrivateKeyExportable.createKeypair();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(createDidDocumentFetch(await keypair.exportPublicKey('multikey')));
    vi.stubGlobal('fetch', fetchSpy);
    const now = Math.floor(Date.now() / 1_000);
    const option = {
      keypair: keypair,
      issuer: 'did:plc:wrong',
      audience: 'did:web:wrong',
      lxm: 'com.example.wrong.method',
      issuedAt: now,
      expiresIn: 60,
    } as CreateServiceJwtOptions;
    const token = await createServiceJwt(option);
    const req = new Request('http://com.example.host', {
      headers: { Authorization: `Bearer ${token}` },
    });
    await expect(requireAuth(req, 'com.example.test')).rejects.toBeDefined();
    fetchSpy.mockRestore();
  });

  it('Given requiredAuth=true, valid Bearer token and network error When called  Then throws AuthRequiredError', async () => {
    const logger = createLogger({ service: 'test', minLevel: 'debug' });
    const requireAuth = createRequireAuth(true, 'com.example.host', 60, logger);
    const keypair = await Secp256k1PrivateKeyExportable.createKeypair();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.reject(new Error('network error')));
    const now = Math.floor(Date.now() / 1_000);
    const option = {
      keypair: keypair,
      issuer: 'did:plc:12345qq5tlnx4f5qvtpntest',
      audience: 'did:web:com.example.host',
      lxm: 'com.example.test',
      issuedAt: now,
      expiresIn: 60,
    } as CreateServiceJwtOptions;
    const token = await createServiceJwt(option);
    const req = new Request('http://com.example.host', {
      headers: { Authorization: `Bearer ${token}` },
    });
    await expect(requireAuth(req, 'com.example.test')).rejects.toBeDefined();
    fetchSpy.mockRestore();
  });
});
