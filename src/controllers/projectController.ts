import { Request, Response } from 'express';
import { dossierService } from '../services/dossierService';
import { projectService } from '../services/projectService';
import { shareService } from '../services/shareService';
import { snapshotService } from '../services/snapshotService';
import { sendSuccess } from '../utils/apiResponse';
import { logger, maskPhone } from '../utils/logger';
import { requiredParam } from '../utils/requestParams';

export const projectController = {
  async create(req: Request, res: Response) {
    logger.info('project.create.controller.start', {
      userId: req.auth!.userId,
      role: req.auth!.role,
      projectType: req.body.project_type,
      reviewerPhones: (req.body.reviewer_phones ?? (req.body.reviewer_phone ? [req.body.reviewer_phone] : [])).map(
        maskPhone
      )
    });
    const result = await projectService.createProject(req.auth!.userId, req.auth!.role, req.body);
    return sendSuccess(res, 'Project created successfully', result, 201);
  },

  async list(req: Request, res: Response) {
    logger.info('project.list.controller.start', {
      userId: req.auth!.userId
    });
    const result = await projectService.listProjects(req.auth!.userId, req.auth!.role);
    return sendSuccess(res, 'Projects fetched successfully', result);
  },

  async get(req: Request, res: Response) {
    const projectId = requiredParam(req.params.projectId, 'projectId');
    logger.info('project.get.controller.start', {
      projectId,
      userId: req.auth!.userId
    });
    const result = await projectService.getProject(projectId, req.auth!.userId, req.auth!.role);
    return sendSuccess(res, 'Project fetched successfully', result);
  },

  async complete(req: Request, res: Response) {
    const projectId = requiredParam(req.params.projectId, 'projectId');
    logger.info('project.complete.controller.start', {
      projectId,
      userId: req.auth!.userId
    });
    const result = await projectService.completeProject(projectId, req.auth!.userId, req.auth!.role);
    return sendSuccess(res, 'Project completed successfully', result);
  },

  async abandon(req: Request, res: Response) {
    const projectId = requiredParam(req.params.projectId, 'projectId');
    logger.info('project.abandon.controller.start', {
      projectId,
      userId: req.auth!.userId
    });
    const result = await projectService.abandonProject(projectId, req.auth!.userId, req.auth!.role);
    return sendSuccess(res, 'Project abandoned successfully', result);
  },

  async inviteReviewer(req: Request, res: Response) {
    const projectId = requiredParam(req.params.projectId, 'projectId');
    logger.info('project.invite_reviewer.controller.start', {
      projectId,
      userId: req.auth!.userId,
      reviewerPhone: maskPhone(req.body.reviewer_phone)
    });
    const result = await projectService.inviteReviewer(
      projectId,
      req.auth!.userId,
      req.body.reviewer_phone
    );
    return sendSuccess(res, 'Reviewer invited successfully', result);
  },

  async createSnapshot(req: Request, res: Response) {
    const projectId = requiredParam(req.params.projectId, 'projectId');
    logger.info('snapshot.create.controller.start', {
      projectId,
      userId: req.auth!.userId
    });
    const result = await snapshotService.createSnapshot(projectId, req.auth!.userId, req.body);
    return sendSuccess(res, 'Snapshot created successfully', result, 201);
  },

  async listSnapshots(req: Request, res: Response) {
    const projectId = requiredParam(req.params.projectId, 'projectId');
    logger.info('snapshot.list.controller.start', {
      projectId,
      userId: req.auth!.userId
    });
    const result = await snapshotService.listSnapshots(projectId, req.auth!.userId);
    return sendSuccess(res, 'Snapshots fetched successfully', result);
  },

  async createShareLink(req: Request, res: Response) {
    const projectId = requiredParam(req.params.projectId, 'projectId');
    logger.info('share.project_create.controller.start', {
      projectId,
      userId: req.auth!.userId
    });
    const result = await shareService.createProjectShareLink(projectId, req.auth!.userId);
    return sendSuccess(res, 'Share link created successfully', result, 201);
  },

  async dossier(req: Request, res: Response) {
    const projectId = requiredParam(req.params.projectId, 'projectId');
    logger.info('dossier.project.controller.start', {
      projectId,
      userId: req.auth!.userId
    });
    const result = await dossierService.projectDossier(projectId, req.auth!.userId);
    return sendSuccess(res, 'Project dossier fetched successfully', result);
  }
};
