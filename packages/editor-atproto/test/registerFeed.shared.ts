import { env } from 'cloudflare:workers';

import { countFeedRowsByUri, findFeedRowByUri } from './feedTest.shared';
import { clearTables, expectJsonResponse, requestPath } from './index.shared';

export const ENDPOINT_PATH = '/xrpc/net.nusno.gyoka.feed.registerFeed';

export async function registerFeed(
  feed: { uri: string; langFilter?: boolean; isActive?: boolean },
  envOverrides?: Partial<Env>
) {
  const response = await requestPath(
    ENDPOINT_PATH,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(feed),
    },
    {
      ...env,
      ...envOverrides,
    }
  );

  return {
    response,
    json: (await response.json()) as
      | { message?: string; feed?: { uri: string; langFilter: boolean; isActive: boolean } }
      | { error: string; message?: string },
  };
}

export function assertValidResponse(response: Response) {
  expectJsonResponse(response);
}

export { countFeedRowsByUri, findFeedRowByUri };

export async function resetRegisterFeedTables() {
  await clearTables(['feeds']);
}
