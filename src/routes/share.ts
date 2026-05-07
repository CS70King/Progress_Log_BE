import { Router } from 'express';
import { shareController } from '../controllers/shareController';
import { validateParams } from '../middlewares/validate';
import { shareTokenParamSchema } from '../validators/shareSchemas';
import { asyncHandler } from '../utils/asyncHandler';

export const shareRouter = Router();

shareRouter.get('/:token/dossier', validateParams(shareTokenParamSchema), asyncHandler(shareController.dossier));
