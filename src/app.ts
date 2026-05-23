import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { AppError } from './utils/appError';
import { env } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import { runtimeState } from './runtime/state';
import { apiRouter } from './routes';
import { sendError } from './utils/apiResponse';
import { logger } from './utils/logger';

export const app = express();

const allowedOrigins = env.CORS_ORIGIN.split(',').map((value) => value.trim()).filter(Boolean);

app.disable('x-powered-by');
app.set('trust proxy', env.TRUST_PROXY);
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      logger.warn('http.cors.origin_denied', {
        origin
      });
      callback(new AppError(403, 'CORS origin forbidden', 'FORBIDDEN'));
    },
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type']
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use((req, res, next) => {
  const startedAt = Date.now();

  logger.info('http.request.start', {
    method: req.method,
    path: req.originalUrl
  });

  res.on('finish', () => {
    logger.info('http.request.finish', {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt
    });
  });

  next();
});
app.use((req, res, next) => {
  if (!runtimeState.isShuttingDown()) {
    return next();
  }

  if (req.path.startsWith('/health')) {
    return next();
  }

  res.setHeader('Connection', 'close');
  return next(new AppError(503, 'Server is shutting down', 'SERVICE_UNAVAILABLE'));
});
app.use(apiRouter);

app.use((_req, res) => {
  return sendError(res, 404, 'Route not found');
});

app.use(errorHandler);
