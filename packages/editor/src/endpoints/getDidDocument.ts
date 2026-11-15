// https://www.w3.org/TR/did-spec-registries/#did-document-properties

export function getDidDocument(env: Env): Response {
  const response = {
    '@context': ['https://www.w3.org/ns/did/v1'],
    id: `did:web:${env.GYOKA_EDITOR_HOST}`,
    service: [
      {
        id: '#gyoka_editor',
        type: 'GyokaEditor',
        serviceEndpoint: `https://${env.GYOKA_EDITOR_HOST}`,
      },
    ],
  };

  return new Response(JSON.stringify(response), {
    headers: {
      'Content-Type': 'application/did+ld+json',
    },
  });
}
