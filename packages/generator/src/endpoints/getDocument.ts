import { DOCUMENT_TYPES } from 'shared/src/constants';
import { NotFoundError } from 'shared/src/errors/core';

// get service document from D1 documents table

export async function getDocument(env: Env, type: string): Promise<Response> {
  if (!type || (type !== DOCUMENT_TYPES.PRIVACY_POLICY && type !== DOCUMENT_TYPES.TOS)) {
    throw new NotFoundError('Content not found');
  }

  const SQL_SELECT_DOCUMENT = `
        SELECT url, content
        FROM documents
        WHERE type = ?
        LIMIT 1
    `;
  const result = await env.DB.prepare(SQL_SELECT_DOCUMENT).bind(type).first<{
    url: string | null;
    content: string | null;
  }>();

  if (result === null || (result.url === null && result.content === null)) {
    throw new NotFoundError('Document not found');
  }

  let text: string;
  if (result.url && result.url !== '' && (result.content === null || result.content === '')) {
    text = `See document at ${result.url}`;
  } else if (result.url === null || result.url === '') {
    text = result.content as string;
  } else {
    text = `You can view the document at ${result.url}\n${result.content as string}`;
  }

  return new Response(text, { status: 200 });
}
