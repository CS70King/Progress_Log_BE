import { Router } from 'express';
import { milestoneController } from '../controllers/milestoneController';
import { projectController } from '../controllers/projectController';
import { requireAuth } from '../middlewares/auth';
import { validateBody, validateParams } from '../middlewares/validate';
import {
  createProjectSchema,
  inviteReviewerSchema,
  projectIdParamSchema
} from '../validators/projectSchemas';
import { createMilestoneSchema } from '../validators/milestoneSchemas';
import { createSnapshotSchema } from '../validators/snapshotSchemas';
import { shareProjectSchema } from '../validators/shareSchemas';
import { asyncHandler } from '../utils/asyncHandler';

export const projectRouter = Router();

projectRouter.use(requireAuth);

projectRouter.post('/', validateBody(createProjectSchema), asyncHandler(projectController.create));
projectRouter.get('/', asyncHandler(projectController.list));
projectRouter.get('/:projectId', validateParams(projectIdParamSchema), asyncHandler(projectController.get));
projectRouter.post('/:projectId/complete', validateParams(projectIdParamSchema), asyncHandler(projectController.complete));
projectRouter.post('/:projectId/abandon', validateParams(projectIdParamSchema), asyncHandler(projectController.abandon));
projectRouter.post('/:projectId/invite-reviewer',validateParams(projectIdParamSchema),validateBody(inviteReviewerSchema), 
asyncHandler(projectController.inviteReviewer)
);
projectRouter.post(
  '/:projectId/milestones',
  validateParams(projectIdParamSchema),
  validateBody(createMilestoneSchema),
  asyncHandler(milestoneController.create)
);
projectRouter.get(
  '/:projectId/milestones',
  validateParams(projectIdParamSchema),
  asyncHandler(milestoneController.list)
);
projectRouter.post(
  '/:projectId/snapshots',
  validateParams(projectIdParamSchema),
  validateBody(createSnapshotSchema),
  asyncHandler(projectController.createSnapshot)
);
projectRouter.get(
  '/:projectId/snapshots',
  validateParams(projectIdParamSchema),
  asyncHandler(projectController.listSnapshots)
);
projectRouter.post(
  '/:projectId/share',
  validateParams(projectIdParamSchema),
  validateBody(shareProjectSchema),
  asyncHandler(projectController.createShareLink)
);
projectRouter.get(
  '/:projectId/dossier',
  validateParams(projectIdParamSchema),
  asyncHandler(projectController.dossier)
);
