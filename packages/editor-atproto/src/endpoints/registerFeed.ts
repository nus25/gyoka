import { ConflictError, InternalServerError } from 'shared/src/errors/core';

const SQL_INSERT_FEED = 'INSERT INTO feeds (feed_uri, lang_filter, is_active) VALUES (?, ?, ?)';

export async function registerFeed(
  db: Env['DB'],
  input: { uri: string; langFilter?: boolean; isActive?: boolean }
): Promise<Response> {
  const langFilter = input.langFilter ?? true;
  const isActive = input.isActive ?? true;

  try {
    const { success } = await db
      .prepare(SQL_INSERT_FEED)
      .bind(input.uri, langFilter, isActive)
      .run();

    if (!success) {
      throw new InternalServerError('Failed to register feed');
    }
  } catch (error) {
    if (error instanceof InternalServerError) {
      throw error;
    }

    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      throw new ConflictError(`Feed with URI ${input.uri} already exists.`);
    }

    throw error;
  }

  return Response.json({
    message: 'Feed registered successfully',
    feed: {
      uri: input.uri,
      langFilter,
      isActive,
    },
  });
}
