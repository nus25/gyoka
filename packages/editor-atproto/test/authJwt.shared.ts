import { Secp256k1PrivateKeyExportable } from '@atcute/crypto';
import { createServiceJwt, type CreateServiceJwtOptions } from '@atcute/xrpc-server/auth';

export async function createServiceJwtToken(options: {
  issuer: string;
  audience: string;
  lxm: string;
}) {
  const keypair = await Secp256k1PrivateKeyExportable.createKeypair();
  const now = Math.floor(Date.now() / 1_000);
  const jwtOptions = {
    keypair,
    issuer: options.issuer,
    audience: options.audience,
    lxm: options.lxm,
    issuedAt: now,
    expiresIn: 60,
  } as CreateServiceJwtOptions;

  const token = await createServiceJwt(jwtOptions);
  const publicKey = await keypair.exportPublicKey('multikey');

  return { token, publicKey };
}

export function createDidDocumentFetch(issuer: string, publicKey: string) {
  return async (input: RequestInfo | URL): Promise<Response> => {
    const requestUrl = input instanceof Request ? input.url : String(input);
    if (!requestUrl.startsWith('https://plc.directory/')) {
      return new Response('Not Found', { status: 404 });
    }

    const did = decodeURIComponent(requestUrl.replace('https://plc.directory/', ''));
    if (did !== issuer) {
      return new Response('Not Found', { status: 404 });
    }

    return new Response(
      JSON.stringify({
        '@context': [
          'https://www.w3.org/ns/did/v1',
          'https://w3id.org/security/multikey/v1',
          'https://w3id.org/security/suites/secp256k1-2019/v1',
        ],
        id: issuer,
        alsoKnownAs: ['at://test.example.com'],
        verificationMethod: [
          {
            id: `${issuer}#atproto`,
            type: 'Multikey',
            controller: issuer,
            publicKeyMultibase: publicKey,
          },
        ],
        service: [
          {
            id: '#atproto_pds',
            type: 'AtprotoPersonalDataServer',
            serviceEndpoint: 'https://test.example.com',
          },
        ],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/did+ld+json' },
      }
    );
  };
}
