import { Request, Response } from 'express';
import { evidenceService } from '../services/evidenceService';
import { milestoneService } from '../services/milestoneService';
import { reviewService } from '../services/reviewService';
import { sendSuccess } from '../utils/apiResponse';
import { logger } from '../utils/logger';
import { requiredParam } from '../utils/requestParams';

export const milestoneController = {
  async create(req: Request, res: Response) {
    const projectId = requiredParam(req.params.projectId, 'projectId');
    logger.info('milestone.create.controller.start', {
      projectId,
      userId: req.auth!.userId
    });
    const result = await milestoneService.createMilestone(projectId, req.auth!.userId, req.body);
    return sendSuccess(res, 'Milestone created successfully', result, 201);
  },

  async list(req: Request, res: Response) {
    const projectId = requiredParam(req.params.projectId, 'projectId');
    logger.info('milestone.list.controller.start', {
      projectId,
      userId: req.auth!.userId
    });
    const result = await milestoneService.listMilestones(projectId, req.auth!.userId, req.auth!.role);
    return sendSuccess(res, 'Milestones fetched successfully', result);
  },

  async get(req: Request, res: Response) {
    const milestoneId = requiredParam(req.params.milestoneId, 'milestoneId');
    logger.info('milestone.get.controller.start', {
      milestoneId,
      userId: req.auth!.userId
    });
    const result = await milestoneService.getMilestone(milestoneId, req.auth!.userId, req.auth!.role);
    return sendSuccess(res, 'Milestone fetched successfully', result);
  },

  async update(req: Request, res: Response) {
    const milestoneId = requiredParam(req.params.milestoneId, 'milestoneId');
    logger.info('milestone.update.controller.start', {
      milestoneId,
      userId: req.auth!.userId
    });
    const result = await milestoneService.updateMilestone(milestoneId, req.auth!.userId, req.body);
    return sendSuccess(res, 'Milestone updated successfully', result);
  },

  async submit(req: Request, res: Response) {
    const milestoneId = requiredParam(req.params.milestoneId, 'milestoneId');
    logger.info('milestone.submit.controller.start', {
      milestoneId,
      userId: req.auth!.userId
    });
    const result = await milestoneService.submitMilestone(milestoneId, req.auth!.userId);
    return sendSuccess(res, 'Milestone submitted successfully', result);
  },

  async uploadEvidence(req: Request, res: Response) {
    const milestoneId = requiredParam(req.params.milestoneId, 'milestoneId');
    const files = (req.files as Express.Multer.File[]) ?? [];
    logger.info('evidence.upload.controller.start', {
      milestoneId,
      userId: req.auth!.userId,
      fileCount: files.length,
      evidenceType: req.body.evidence_type
    });
    const result = await evidenceService.uploadEvidence(milestoneId, req.auth!.userId, req.body, files);
    return sendSuccess(res, 'Evidence uploaded successfully', result, 201);
  },

  async review(req: Request, res: Response) {
    const milestoneId = requiredParam(req.params.milestoneId, 'milestoneId');
    logger.info('review.create.controller.start', {
      milestoneId,
      userId: req.auth!.userId,
      decision: req.body.decision
    });
    const result = await reviewService.reviewMilestone(milestoneId, req.auth!.userId, req.body);
    return sendSuccess(res, 'Milestone reviewed successfully', result);
  }
};
