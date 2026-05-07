import { RequestHandler } from 'express';
import { ZodError, ZodSchema, ZodTypeAny } from 'zod';
import { AppError } from '../utils/appError';

const toFieldErrors = (error: ZodError) => {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message
  }));
};

const validateFactory = <T>(schema: ZodSchema<T>, picker: (req: Parameters<RequestHandler>[0]) => unknown) => {
  return ((req, _res, next) => {
    const result = schema.safeParse(picker(req));

    if (!result.success) {
      return next(new AppError(400, 'Validation error', 'VALIDATION_ERROR', toFieldErrors(result.error)));
    }

    next();
  }) as RequestHandler;
};

export const validateBody = <T extends ZodTypeAny>(schema: T) => validateFactory(schema, (req) => req.body);

export const validateParams = <T extends ZodTypeAny>(schema: T) => validateFactory(schema, (req) => req.params);

export const validateQuery = <T extends ZodTypeAny>(schema: T) => validateFactory(schema, (req) => req.query);
