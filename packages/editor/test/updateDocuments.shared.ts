import { DOCUMENT_TYPES } from 'shared/src/constants';

import { clearTables, expectJsonResponse, requestJson } from './testUtils';

export const ENDPOINT_PATH = '/api/gyoka/updateDocument';

export const VALID_DOCUMENT_TYPE = DOCUMENT_TYPES.TOS;

export async function updateDocument(
  request: {
    type: string;
    url?: string;
    content?: string;
  },
  envOverrides?: Partial<Env>
) {
  return requestJson<{
    type?: string;
    url?: string | null;
    content?: string | null;
    error?: string;
  }>({
    path: ENDPOINT_PATH,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    },
    envOverrides,
  });
}

export function assertValidResponse(response: Response) {
  expectJsonResponse(response);
}

export async function resetDocumentsTable() {
  await clearTables(['documents']);
}
