import { Router } from 'express';
import { healthController } from '../controllers/healthController';
import { asyncHandler } from '../utils/asyncHandler';

export const healthRouter = Router();

healthRouter.get('/', asyncHandler(healthController.health));
healthRouter.get('/db', asyncHandler(healthController.database));
