export const createDidDocumentFetch = (publicKey: string) => {
  return async (input: RequestInfo) => {
    if ((input as Request).url.startsWith('https://plc.directory/')) {
      // return mock DID document
      return new Response(
        JSON.stringify({
          '@context': [
            'https://www.w3.org/ns/did/v1',
            'https://w3id.org/security/multikey/v1',
            'https://w3id.org/security/suites/secp256k1-2019/v1',
          ],
          id: 'did:plc:12345qq5tlnx4f5qvtpntest',
          alsoKnownAs: ['at://test.example.com'],
          verificationMethod: [
            {
              id: 'did:plc:12345qq5tlnx4f5qvtpntest#atproto',
              type: 'Multikey',
              controller: 'did:plc:12345qq5tlnx4f5qvtpntest',
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
        { status: 200, headers: { 'Content-Type': 'application/did+ld+json' } }
      );
    }
    return new Response('Not Found', { status: 404 });
  };
};
