import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { sendSuccess } from '../utils/apiResponse';
import { logger } from '../utils/logger';

export const healthController = {
  async health(_req: Request, res: Response) {
    logger.info('health.controller.start');
    return sendSuccess(res, 'Health check successful', {
      status: 'ok',
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
