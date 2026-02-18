import { OpenAPIRoute } from 'chanfana';
import * as z from 'zod';
import { createErrorResponse } from './errors';

export type ValidationErrorDetail = {
  message: string;
  path: (string | number)[];
};

export abstract class BaseOpenAPIRoute extends OpenAPIRoute {
  protected buildValidationErrorPayload(errors: z.core.$ZodIssue[]): ValidationErrorDetail[] {
    return errors.map(
      (error) =>
        ({
          message: error.message,
          path: error.path,
        }) as ValidationErrorDetail
    );
  }

  handleValidationError(errors: z.core.$ZodIssue[]): Response {
    const validationDetails = this.buildValidationErrorPayload(errors);
    const payload = JSON.stringify(validationDetails);
    return createErrorResponse('BadRequest', payload, 400, {
      event: 'api.validate.request.failed',
      level: 'warn',
      details: {
        issues: validationDetails,
      },
    });
  }
}
