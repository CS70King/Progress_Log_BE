import { Router } from 'express';
import { authController } from '../controllers/authController';
import { requireAuth } from '../middlewares/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { authRouter } from './auth';
import { evidenceRouter } from './evidence';
import { healthRouter } from './health';
import { milestoneRouter } from './milestones';
import { projectRouter } from './projects';
import { shareRouter } from './share';
import { snapshotRouter } from './snapshots';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.get('/me', requireAuth, asyncHandler(authController.me));
apiRouter.use('/projects', projectRouter);
apiRouter.use('/milestones', milestoneRouter);
apiRouter.use('/evidence', evidenceRouter);
apiRouter.use('/snapshots', snapshotRouter);
apiRouter.use('/share', shareRouter);
