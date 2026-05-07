import { Router } from 'express';
import { milestoneController } from '../controllers/milestoneController';
import { requireAuth } from '../middlewares/auth';
import { uploadEvidenceFiles } from '../middlewares/upload';
import { validateBody, validateParams } from '../middlewares/validate';
import { evidenceUploadSchema } from '../validators/evidenceSchemas';
import { milestoneIdParamSchema, updateMilestoneSchema } from '../validators/milestoneSchemas';
import { reviewMilestoneSchema } from '../validators/reviewSchemas';
import { asyncHandler } from '../utils/asyncHandler';

export const milestoneRouter = Router();

milestoneRouter.use(requireAuth);

milestoneRouter.get('/:milestoneId', validateParams(milestoneIdParamSchema), asyncHandler(milestoneController.get));
milestoneRouter.patch(
  '/:milestoneId',
  validateParams(milestoneIdParamSchema),
  validateBody(updateMilestoneSchema),
  asyncHandler(milestoneController.update)
);
milestoneRouter.post(
  '/:milestoneId/submit',
  validateParams(milestoneIdParamSchema),
  asyncHandler(milestoneController.submit)
);
milestoneRouter.post(
  '/:milestoneId/evidence',
  validateParams(milestoneIdParamSchema),
  uploadEvidenceFiles('files'),
  validateBody(evidenceUploadSchema),
  asyncHandler(milestoneController.uploadEvidence)
);
milestoneRouter.post(
  '/:milestoneId/review',
  validateParams(milestoneIdParamSchema),
  validateBody(reviewMilestoneSchema),
  asyncHandler(milestoneController.review)
);
