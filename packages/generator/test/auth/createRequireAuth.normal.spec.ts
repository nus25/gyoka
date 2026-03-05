import { Secp256k1PrivateKeyExportable } from '@atcute/crypto';
import { createServiceJwt, CreateServiceJwtOptions } from '@atcute/xrpc-server/auth';
import { createLogger } from 'shared/src/logger';
import { describe, it, vi, expect } from 'vitest';

import { createRequireAuth } from '../../src/auth/createRequireAuth';
import { createDidDocumentFetch } from './createRequireAuth.shared';

describe('Success case', () => {
  it('Given requiredAuth=false When called Then returns null', async () => {
    const logger = createLogger({ service: 'test', minLevel: 'debug' });
    const requireAuth = createRequireAuth(false, 'com.example.host', 60, logger);
    const req = new Request('http://localhost');
    const result = await requireAuth(req, 'com.example.host');
    expect(result).toBeNull();
  });

  it('Given requiredAuth=true, valid Bearer token, and jwtVerifier returns ok When called Then returns VerifiedJwt', async () => {
    const logger = createLogger({ service: 'test', minLevel: 'debug' });
    const requireAuth = createRequireAuth(true, 'com.example.host', 60, logger);
    // create JWT token
    // secp256k1 keypair
    const keypair = await Secp256k1PrivateKeyExportable.createKeypair();

    // mock fetch to https://plc.directory/:did server taht returns a did document with the public key corresponding to the private key used to sign the JWT
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(createDidDocumentFetch(await keypair.exportPublicKey('multikey')));

    // create a JWT token
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

    // call requireAuth and check result
    const result = await requireAuth(req, 'com.example.test');
    expect(fetchSpy).toHaveBeenCalled();
    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      audience: 'did:web:com.example.host',
      issuer: 'did:plc:12345qq5tlnx4f5qvtpntest',
      lxm: 'com.example.test',
    });
    fetchSpy.mockRestore();
  });
});
