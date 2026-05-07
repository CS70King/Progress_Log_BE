import { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/appError';
import { logger } from '../utils/logger';

const prismaErrorResponse = (error: Prisma.PrismaClientKnownRequestError) => {
  if (error.code === 'P2002') {
    return {
      statusCode: 409,
      code: 'CONFLICT',
      message: 'A record with these values already exists'
    };
  }

  if (error.code === 'P2003') {
    return {
      statusCode: 400,
      code: 'INVALID_RELATION',
      message: 'The request references a record that does not exist'
    };
  }

  return null;
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    logger.warn('http.error.handled', {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message
    });

    return res.status(error.statusCode).json({
      status: 'error',
      message: error.message,
      data: null,
      ...(error.errors ? { errors: error.errors } : {})
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const response = prismaErrorResponse(error);

    if (response) {
      logger.warn('http.error.prisma_known', {
        statusCode: response.statusCode,
        code: response.code,
        prismaCode: error.code,
        meta: error.meta ?? null
      });

      return res.status(response.statusCode).json({
        status: 'error',
        message: response.message,
        data: null
      });
    }
  }

  logger.error('http.error.unhandled', {
    message: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : null
  });

  return res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    data: null
  });
};
