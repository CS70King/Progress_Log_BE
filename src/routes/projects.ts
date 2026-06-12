import { Router } from 'express';
import { env } from '../config/env';
import { milestoneController } from '../controllers/milestoneController';
import { projectController } from '../controllers/projectController';
import { requireAuth } from '../middlewares/auth';
import { createRateLimit } from '../middlewares/rateLimit';
import { uploadEvidenceFiles } from '../middlewares/upload';
import { validateBody, validateParams } from '../middlewares/validate';
import {
  createProjectSchema,
  inviteReviewerSchema,
  projectIdParamSchema
} from '../validators/projectSchemas';
import { createMilestoneSchema, createMilestoneWithEvidenceSchema } from '../validators/milestoneSchemas';
import { createSnapshotSchema } from '../validators/snapshotSchemas';
import { projectShareLinkParamSchema, shareProjectSchema } from '../validators/shareSchemas';
import { asyncHandler } from '../utils/asyncHandler';

export const projectRouter = Router();

projectRouter.use(requireAuth);

const evidenceUploadRateLimit = createRateLimit({
  keyPrefix: 'evidence-upload',
  windowMs: env.EVIDENCE_UPLOAD_RATE_LIMIT_WINDOW_MS,
  max: env.EVIDENCE_UPLOAD_RATE_LIMIT_MAX,
  resolveKey: (req) => `${req.auth?.userId ?? 'unknown'}:${req.ip || 'unknown'}`
});

projectRouter.post('/', validateBody(createProjectSchema), asyncHandler(projectController.create));
projectRouter.get('/', asyncHandler(projectController.list));
projectRouter.get('/:projectId', validateParams(projectIdParamSchema), asyncHandler(projectController.get));
projectRouter.post('/:projectId/complete', validateParams(projectIdParamSchema), asyncHandler(projectController.complete));
projectRouter.post('/:projectId/abandon', validateParams(projectIdParamSchema), asyncHandler(projectController.abandon));
projectRouter.post('/:projectId/invite-reviewer',validateParams(projectIdParamSchema),validateBody(inviteReviewerSchema), 
asyncHandler(projectController.inviteReviewer)
);
projectRouter.post(
  '/:projectId/milestones/with-evidence',
  validateParams(projectIdParamSchema),
  evidenceUploadRateLimit,
  uploadEvidenceFiles('files'),
  validateBody(createMilestoneWithEvidenceSchema),
  asyncHandler(milestoneController.createWithEvidence)
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
projectRouter.delete(
  '/:projectId/share/:shareLinkId',
  validateParams(projectShareLinkParamSchema),
  asyncHandler(projectController.revokeShareLink)
);
projectRouter.get(
  '/:projectId/dossier',
  validateParams(projectIdParamSchema),
  asyncHandler(projectController.dossier)
);
