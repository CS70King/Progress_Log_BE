import { Router } from 'express';
import { env } from '../config/env';
import { shareController } from '../controllers/shareController';
import { createRateLimit } from '../middlewares/rateLimit';
import { validateParams } from '../middlewares/validate';
import { shareTokenParamSchema } from '../validators/shareSchemas';
import { asyncHandler } from '../utils/asyncHandler';

export const shareRouter = Router();

const shareLookupRateLimit = createRateLimit({
  keyPrefix: 'share-dossier',
  windowMs: env.SHARE_LOOKUP_RATE_LIMIT_WINDOW_MS,
  max: env.SHARE_LOOKUP_RATE_LIMIT_MAX
});

shareRouter.get(
  '/:token/dossier',
  shareLookupRateLimit,
  validateParams(shareTokenParamSchema),
  asyncHandler(shareController.dossier)
);
