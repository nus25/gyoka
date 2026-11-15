import { env } from 'cloudflare:workers';

import { requestPath } from './index.shared';

export const ENDPOINT_PATH = '/.well-known/did.json';

export async function getDidDocument(envOverrides?: Partial<Env>) {
  const response = await requestPath(ENDPOINT_PATH, undefined, {
    ...env,
    ...envOverrides,
  });

  return {
    response,
    json: (await response.json()) as {
      '@context'?: string[];
      id?: string;
      service?: Array<{ id: string; type: string; serviceEndpoint: string }>;
      error?: string;
      message?: string;
    },
  };
}
