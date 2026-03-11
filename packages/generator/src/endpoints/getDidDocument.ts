// https://www.w3.org/TR/did-spec-registries/#did-document-properties

export function getDidDocument(env: Env): Response {
  const response = {
    '@context': ['https://www.w3.org/ns/did/v1'],
    id: `did:web:${env.FEEDGEN_HOST}`,
    service: [
      {
        id: '#bsky_fg',
        type: 'BskyFeedGenerator',
        serviceEndpoint: `https://${env.FEEDGEN_HOST}`,
      },
    ],
  };

  return new Response(JSON.stringify(response), {
    headers: {
      'Content-Type': 'application/did+ld+json',
    },
  });
}
