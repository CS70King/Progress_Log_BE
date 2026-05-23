import { app } from './app';
import { env } from './config/env';
import { prisma } from './db/prisma';
import { runtimeState } from './runtime/state';
import { storageDriver } from './storage';
import { logger } from './utils/logger';

const server = app.listen(env.PORT, () => {
  console.log(`Progress Log backend listening on port ${env.PORT}`);
  logger.info('app.start', {
    nodeEnv: env.NODE_ENV,
    storageDriver,
    supabaseUrl: env.SUPABASE_URL ?? null,
    storageBucket: env.SUPABASE_STORAGE_BUCKET
  });
});

server.requestTimeout = env.REQUEST_TIMEOUT_MS;
server.keepAliveTimeout = env.KEEP_ALIVE_TIMEOUT_MS;
server.headersTimeout = env.HEADERS_TIMEOUT_MS;

const closeServer = () =>
  new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

const formatUnknownError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack ?? null
    };
  }

  return {
    message: String(error),
    stack: null
  };
};

let shutdownPromise: Promise<void> | null = null;

const shutdown = (signal: string, exitCode = 0) => {
  if (shutdownPromise) {
    return shutdownPromise;
  }

  runtimeState.beginShutdown();
  logger.warn('app.shutdown.start', {
    signal,
    gracePeriodMs: env.SHUTDOWN_GRACE_PERIOD_MS
  });

  server.closeIdleConnections?.();

  shutdownPromise = (async () => {
    const forceTimer = setTimeout(() => {
      logger.error('app.shutdown.force_exit', {
        signal,
        timeoutMs: env.SHUTDOWN_GRACE_PERIOD_MS
      });
      server.closeAllConnections?.();
      process.exit(1);
    }, env.SHUTDOWN_GRACE_PERIOD_MS);

    forceTimer.unref();

    try {
      await closeServer();
      await prisma.$disconnect();
      logger.info('app.shutdown.complete', {
        signal
      });
      process.exit(exitCode);
    } catch (error) {
      logger.error('app.shutdown.failed', {
        signal,
        ...formatUnknownError(error)
      });
      process.exit(1);
    }
  })();

  return shutdownPromise;
};

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('unhandledRejection', (reason) => {
  logger.error('process.unhandled_rejection', formatUnknownError(reason));
  void shutdown('unhandledRejection', 1);
});

process.on('uncaughtException', (error) => {
  logger.error('process.uncaught_exception', formatUnknownError(error));
  void shutdown('uncaughtException', 1);
});
