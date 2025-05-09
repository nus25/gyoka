import { type Context } from 'hono';

export type AppContext = Context<{ Bindings: Env }>;

export type ErrorResponse = {
  error: string;
  message?: string;
};

export function createErrorResponse(error: string, message: string, status: number): Response {
  const responseBody: ErrorResponse = { error, message };
  return new Response(JSON.stringify(responseBody), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
