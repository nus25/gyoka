import { callQuery, resetFeedTables } from './feedTest.shared';

export const ENDPOINT_PATH = '/xrpc/net.nusno.gyoka.document.getDocument';

export async function getDocument(
  input: { docType: 'tos' | 'privacy_policy' | string },
  envOverrides?: Partial<Env>
) {
  const params = new URLSearchParams();
  params.set('docType', input.docType);

  return callQuery(`${ENDPOINT_PATH}?${params.toString()}`, envOverrides);
}

export { resetFeedTables };
