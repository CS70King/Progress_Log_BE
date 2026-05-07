import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import { apiRouter } from './routes';
import { sendError } from './utils/apiResponse';
import { logger } from './utils/logger';

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN.split(',').map((value) => value.trim()),
    credentials: true
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
app.use(apiRouter);

app.use((_req, res) => {
  return sendError(res, 404, 'Route not found');
});

app.use(errorHandler);
