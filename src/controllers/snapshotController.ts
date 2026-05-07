import { Request, Response } from 'express';
import { dossierService } from '../services/dossierService';
import { shareService } from '../services/shareService';
import { snapshotService } from '../services/snapshotService';
import { sendSuccess } from '../utils/apiResponse';
import { logger } from '../utils/logger';
import { requiredParam } from '../utils/requestParams';

export const snapshotController = {
  async get(req: Request, res: Response) {
    const snapshotId = requiredParam(req.params.snapshotId, 'snapshotId');
    logger.info('snapshot.get.controller.start', {
      snapshotId,
      userId: req.auth!.userId
    });
    const result = await snapshotService.getSnapshot(snapshotId, req.auth!.userId);
    return sendSuccess(res, 'Snapshot fetched successfully', result);
  },

  async createShareLink(req: Request, res: Response) {
    const snapshotId = requiredParam(req.params.snapshotId, 'snapshotId');
    logger.info('share.snapshot_create.controller.start', {
      snapshotId,
      userId: req.auth!.userId
    });
    const result = await shareService.createSnapshotShareLink(snapshotId, req.auth!.userId);
    return sendSuccess(res, 'Snapshot share link created successfully', result, 201);
  },

  async dossier(req: Request, res: Response) {
    const snapshotId = requiredParam(req.params.snapshotId, 'snapshotId');
    logger.info('dossier.snapshot.controller.start', {
      snapshotId,
      userId: req.auth!.userId
    });
    const result = await dossierService.snapshotDossier(snapshotId, req.auth!.userId);
    return sendSuccess(res, 'Snapshot dossier fetched successfully', result);
  }
};
