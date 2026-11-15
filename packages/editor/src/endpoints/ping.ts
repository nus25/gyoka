import { json } from '@atcute/xrpc-server';

export function ping(): Response {
  return json({
    message: 'Gyoka is available',
  });
}
