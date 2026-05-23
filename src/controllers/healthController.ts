import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { runtimeState } from '../runtime/state';
import { sendSuccess } from '../utils/apiResponse';
import { logger } from '../utils/logger';

export const healthController = {
  async health(_req: Request, res: Response) {
    logger.info('health.controller.start');
    return sendSuccess(res, 'Health check successful', {
      status: runtimeState.isShuttingDown() ? 'shutting_down' : 'ok',
      timestamp: new Date().toISOString(),
      started_at: runtimeState.startedAt.toISOString(),
      uptime_seconds: Math.floor((Date.now() - runtimeState.startedAt.getTime()) / 1000)
    });
  },

  async readiness(_req: Request, res: Response) {
    logger.info('health.readiness.controller.start');

    if (runtimeState.isShuttingDown()) {
      return res.status(503).json({
        status: 'error',
        message: 'Server is shutting down',
        data: {
          status: 'not_ready',
          timestamp: new Date().toISOString()
        }
      });
    }

    await prisma.$queryRaw`SELECT 1`;

    return sendSuccess(res, 'Readiness check successful', {
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  },

  async database(_req: Request, res: Response) {
    logger.info('health.database.controller.start');
    await prisma.$queryRaw`SELECT 1`;

    return sendSuccess(res, 'Database health check successful', {
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  }
};
