import { RequestHandler } from 'express';
import { UserRole } from '@prisma/client';
import { verifyAccessToken } from '../utils/jwt';
import { AppError } from '../utils/appError';

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError(401, 'Authentication required', 'UNAUTHORIZED'));
  }

  const token = header.slice(7);

  try {
    const payload = verifyAccessToken(token);
    req.auth = {
      userId: payload.userId,
      role: payload.role
    };
    return next();
  } catch {
    return next(new AppError(401, 'Invalid or expired token', 'UNAUTHORIZED'));
  }
};

export const requireRole = (...roles: UserRole[]): RequestHandler => {
  return (req, _res, next) => {
    if (!req.auth) {
      return next(new AppError(401, 'Authentication required', 'UNAUTHORIZED'));
    }

    if (!roles.includes(req.auth.role)) {
      return next(new AppError(403, 'Forbidden', 'FORBIDDEN'));
    }

    return next();
  };
};
