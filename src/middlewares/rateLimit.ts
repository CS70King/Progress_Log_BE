import { Request, RequestHandler } from 'express';
import { AppError } from '../utils/appError';
import { logger } from '../utils/logger';
import { rateLimitStore } from '../services/rateLimitStore';

type RateLimitOptions = {
  keyPrefix: string;
  windowMs: number;
  max: number;
  resolveKey?: (req: Request) => string;
};

const defaultResolveKey = (req: Request) => req.ip || 'unknown';

export const createRateLimit = ({ keyPrefix, windowMs, max, resolveKey = defaultResolveKey }: RateLimitOptions): RequestHandler => {
  return async (req, res, next) => {
    try {
      const rawKey = resolveKey(req) || 'unknown';
      const key = `${keyPrefix}:${rawKey}`;
      const result = await rateLimitStore.increment(key, windowMs);

      if (result.count > max) {
        const retryAfterSeconds = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
        res.setHeader('Retry-After', retryAfterSeconds.toString());
        logger.warn('http.rate_limit.exceeded', {
          keyPrefix,
          clientIp: req.ip,
          path: req.originalUrl,
          method: req.method,
          retryAfterSeconds
        });
        return next(new AppError(429, 'Too many requests, please try again later', 'RATE_LIMITED'));
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
};
