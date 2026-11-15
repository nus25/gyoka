import { parseCanonicalResourceUri } from '@atcute/lexicons/syntax';
import { BadRequestError } from 'shared/src/errors/core';

export function assertAtUriCollection(
  uri: string,
  expectedCollection: string,
  label = 'AT URI'
): void {
  let parsedUri: ReturnType<typeof parseCanonicalResourceUri>;
  try {
    parsedUri = parseCanonicalResourceUri(uri);
  } catch {
    throw new BadRequestError(`Invalid ${label}`);
  }

  if (!parsedUri) {
    throw new BadRequestError(`Invalid ${label}`);
  }

  if (parsedUri.collection !== expectedCollection) {
    throw new BadRequestError(`Invalid ${label} collection`);
  }
}
