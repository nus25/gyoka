import { clearTables, expectJsonResponse, requestJson } from './testUtils';

export const ENDPOINT_PATH = '/api/feed/registerFeed';

export async function registerFeed(
  feed: { uri: string; langFilter?: boolean; isActive?: boolean },
  envOverrides?: Partial<Env>
) {
  return requestJson<
    | { message?: string; feed?: { uri: string; langFilter: boolean; isActive: boolean } }
    | { error: string; message?: string }
  >({
    path: ENDPOINT_PATH,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(feed),
    },
    envOverrides,
  });
}

export function assertValidResponse(response: Response) {
  expectJsonResponse(response);
}

export async function resetRegisterFeedTables() {
  await clearTables(['feeds']);
}
