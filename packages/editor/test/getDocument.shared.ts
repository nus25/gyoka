import { DOCUMENT_TYPES } from 'shared/src/constants';

import { clearTables, expectJsonResponse, requestJson } from './testUtils';

export const ENDPOINT_PATH = '/api/gyoka/getDocument';

export const VALID_DOCUMENT_TYPE = DOCUMENT_TYPES.TOS;

export async function getDocument(type: string, envOverrides?: Partial<Env>) {
  const params = new URLSearchParams({ type });

  return requestJson<{
    type?: string;
    url?: string | null;
    content?: string | null;
    error?: string;
    message?: string;
  }>({
    path: `${ENDPOINT_PATH}?${params.toString()}`,
    envOverrides,
  });
}

export async function insertDocument(type: string, url: string | null, content: string | null) {
  return requestJson<{
    type?: string;
    url?: string | null;
    content?: string | null;
    error?: string;
  }>({
    path: '/api/gyoka/updateDocument',
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type, url, content }),
    },
  });
}

export function assertValidResponse(response: Response) {
  expectJsonResponse(response);
}

export async function resetDocumentsTable() {
  await clearTables(['documents']);
}
