import { callProcedure, resetFeedTables } from './feedTest.shared';

export const ENDPOINT_PATH = '/xrpc/net.nusno.gyoka.document.updateDocument';

export async function updateDocument(input: {
  type: 'tos' | 'privacy_policy';
  url?: string | null;
  content?: string | null;
}) {
  return callProcedure(ENDPOINT_PATH, input);
}

export { resetFeedTables };
