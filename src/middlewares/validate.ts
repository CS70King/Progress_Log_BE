import { RequestHandler } from 'express';
import { ZodError, ZodSchema, ZodTypeAny } from 'zod';
import { AppError } from '../utils/appError';

const toFieldErrors = (error: ZodError) => {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message
  }));
};

const buildValidationMessage = (fieldErrors: ReturnType<typeof toFieldErrors>) => {
  if (fieldErrors.length === 0) {
    return 'Validation error';
  }

  if (fieldErrors.length === 1) {
    return fieldErrors[0]!.message;
  }

  return fieldErrors
    .map((fieldError) => (fieldError.field ? `${fieldError.field}: ${fieldError.message}` : fieldError.message))
    .join('; ');
};

const validateFactory = <T>(schema: ZodSchema<T>, picker: (req: Parameters<RequestHandler>[0]) => unknown) => {
  return ((req, _res, next) => {
    const result = schema.safeParse(picker(req));

    if (!result.success) {
      const fieldErrors = toFieldErrors(result.error);
      return next(new AppError(400, buildValidationMessage(fieldErrors), 'VALIDATION_ERROR', fieldErrors));
    }

    next();
  }) as RequestHandler;
};

export const validateBody = <T extends ZodTypeAny>(schema: T) => validateFactory(schema, (req) => req.body);

export const validateParams = <T extends ZodTypeAny>(schema: T) => validateFactory(schema, (req) => req.params);

export const validateQuery = <T extends ZodTypeAny>(schema: T) => validateFactory(schema, (req) => req.query);
