import { Router } from 'express';
import { evidenceController } from '../controllers/evidenceController';
import { requireAuth } from '../middlewares/auth';
import { validateParams } from '../middlewares/validate';
import { evidenceIdParamSchema } from '../validators/evidenceSchemas';
import { asyncHandler } from '../utils/asyncHandler';

export const evidenceRouter = Router();

evidenceRouter.use(requireAuth);
evidenceRouter.delete(
  '/:evidenceId',
  validateParams(evidenceIdParamSchema),
  asyncHandler(evidenceController.delete)
);
