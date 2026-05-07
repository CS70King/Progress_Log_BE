import { Request, Response } from 'express';
import { evidenceService } from '../services/evidenceService';
import { sendSuccess } from '../utils/apiResponse';
import { logger } from '../utils/logger';
import { requiredParam } from '../utils/requestParams';

export const evidenceController = {
  async delete(req: Request, res: Response) {
    const evidenceId = requiredParam(req.params.evidenceId, 'evidenceId');
    logger.info('evidence.delete.controller.start', {
      evidenceId,
      userId: req.auth!.userId
    });
    const result = await evidenceService.deleteEvidence(evidenceId, req.auth!.userId);
    return sendSuccess(res, 'Evidence deleted successfully', result);
  }
};
