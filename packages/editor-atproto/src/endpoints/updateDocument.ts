import { BadRequestError, InternalServerError } from 'shared/src/errors/core';

const SQL_UPDATE_DOCUMENT =
  'INSERT OR REPLACE INTO documents (type, url, content) VALUES (?, ?, ?)';
const MAX_DOCUMENT_URL_LENGTH = 2048;
const MAX_DOCUMENT_CONTENT_LENGTH = 32768;

type UpdateDocumentInput = {
  type: 'tos' | 'privacy_policy';
  url?: string | null;
  content?: string | null;
};

function assertValidUrlLength(url: string | null): void {
  if (url !== null && url.length > MAX_DOCUMENT_URL_LENGTH) {
    throw new BadRequestError('URL is too long');
  }
}

function assertValidContentLength(content: string | null): void {
  if (content !== null && content.length > MAX_DOCUMENT_CONTENT_LENGTH) {
    throw new BadRequestError('Content is too long');
  }
}

export async function updateDocument(db: Env['DB'], input: UpdateDocumentInput): Promise<Response> {
  const url = input.url ?? null;
  const content = input.content ?? null;

  assertValidUrlLength(url);
  assertValidContentLength(content);

  try {
    const result = await db.prepare(SQL_UPDATE_DOCUMENT).bind(input.type, url, content).run();
    if (!result.success) {
      throw new InternalServerError('Failed to update document');
    }
  } catch (error) {
    if (error instanceof BadRequestError || error instanceof InternalServerError) {
      throw error;
    }
    throw new InternalServerError('Failed to update document');
  }

  return Response.json({
    type: input.type,
    url,
    content,
  });
}
