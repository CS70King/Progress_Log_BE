import { AppError } from './appError';

export const requiredParam = (value: string | string[] | undefined, name: string): string => {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  throw new AppError(400, `Missing or invalid route parameter: ${name}`, 'VALIDATION_ERROR');
};
