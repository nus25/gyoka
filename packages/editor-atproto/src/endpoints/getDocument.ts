import { DOCUMENT_TYPES } from 'shared/src/constants';
import { BadRequestError, InternalServerError, NotFoundError } from 'shared/src/errors/core';

const SQL_SELECT_DOCUMENT = 'SELECT url, content FROM documents WHERE type = ? LIMIT 1';

type DocumentType = 'tos' | 'privacy_policy';

function assertValidDocumentType(type: string): asserts type is DocumentType {
  if (type !== DOCUMENT_TYPES.TOS && type !== DOCUMENT_TYPES.PRIVACY_POLICY) {
    throw new BadRequestError('Invalid document type');
  }
}

export async function getDocument(
  db: Env['DB'],
  input: { type: 'tos' | 'privacy_policy' | string }
): Promise<Response> {
  assertValidDocumentType(input.type);

  try {
    const { success, results } = await db
      .prepare(SQL_SELECT_DOCUMENT)
      .bind(input.type)
      .all<{ url: string | null; content: string | null }>();

    if (!success) {
      throw new InternalServerError('Failed to fetch document');
    }

    if (results.length === 0) {
      throw new NotFoundError('Document not found');
    }

    return Response.json({
      type: input.type,
      url: results[0].url,
      content: results[0].content,
    });
  } catch (error) {
    if (
      error instanceof BadRequestError ||
      error instanceof NotFoundError ||
      error instanceof InternalServerError
    ) {
      throw error;
    }

    throw new InternalServerError('Failed to fetch document');
  }
}
