import { AppError } from './appError';
import { env } from '../config/env';

export const requiredParam = (value: string | string[] | undefined, name: string): string => {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  throw new AppError(400, `Missing or invalid route parameter: ${name}`, 'VALIDATION_ERROR');
};

export const getPaginationParams = (query: Record<string, any>) => {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(
    env.PAGINATION_MAX_LIMIT,
    Math.max(1, parseInt(query.limit as string) || env.PAGINATION_DEFAULT_LIMIT)
  );

  return {
    skip: (page - 1) * limit,
    take: limit,
    page,
    limit
  };
};
