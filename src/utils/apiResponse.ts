import { Response } from 'express';
import { ApiFieldError } from './appError';

export const sendSuccess = (
  res: Response,
  message: string,
  data: unknown = null,
  statusCode = 200
) => {
  return res.status(statusCode).json({
    status: 'success',
    message,
    data
  });
};

export const sendError = (
  res: Response,
  statusCode: number,
  message: string,
  errors?: ApiFieldError[]
) => {
  return res.status(statusCode).json({
    status: 'error',
    message,
    data: null,
    ...(errors ? { errors } : {})
  });
};
