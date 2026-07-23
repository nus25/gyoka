import { env } from 'cloudflare:workers';

import { requestPath } from './index.shared';

export const ENDPOINT_PATH = '/xrpc/net.nusno.gyoka.ping';

type PingOptions = {
  envOverrides?: Partial<Env>;
  headers?: HeadersInit;
};

export async function ping(options: PingOptions = {}) {
  const response = await requestPath(
    ENDPOINT_PATH,
    {
      headers: options.headers,
    },
    {
      ...env,
      ...options.envOverrides,
    }
  );

  return {
    response,
    json: await response.json(),
  };
}
