import { Router } from 'express';
import { snapshotController } from '../controllers/snapshotController';
import { requireAuth } from '../middlewares/auth';
import { validateParams } from '../middlewares/validate';
import { snapshotIdParamSchema } from '../validators/snapshotSchemas';
import { asyncHandler } from '../utils/asyncHandler';

export const snapshotRouter = Router();

snapshotRouter.use(requireAuth);

snapshotRouter.get('/:snapshotId', validateParams(snapshotIdParamSchema), asyncHandler(snapshotController.get));
snapshotRouter.post(
  '/:snapshotId/share',
  validateParams(snapshotIdParamSchema),
  asyncHandler(snapshotController.createShareLink)
);
snapshotRouter.get(
  '/:snapshotId/dossier',
  validateParams(snapshotIdParamSchema),
  asyncHandler(snapshotController.dossier)
);
