import { Request, Response } from 'express';
import { shareService } from '../services/shareService';
import { sendSuccess } from '../utils/apiResponse';
import { logger } from '../utils/logger';
import { requiredParam } from '../utils/requestParams';

export const shareController = {
  async dossier(req: Request, res: Response) {
    const token = requiredParam(req.params.token, 'token');
    logger.info('share.dossier.controller.start', {
      tokenPrefix: token.slice(0, 8)
    });
    const result = await shareService.shareDossier(token);
    return sendSuccess(res, 'Shared dossier fetched successfully', result);
  }
};
