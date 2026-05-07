import { ProjectMemberRole, UserRole } from '@prisma/client';
import { RequestHandler } from 'express';
import { evidenceRepository } from '../repositories/evidenceRepository';
import { milestoneRepository } from '../repositories/milestoneRepository';
import { projectMemberRepository } from '../repositories/projectMemberRepository';
import { projectRepository } from '../repositories/projectRepository';
import { snapshotRepository } from '../repositories/snapshotRepository';
import { AppError } from '../utils/appError';

type ResourceSource = 'project' | 'milestone' | 'evidence' | 'snapshot';

const resolveProjectId = async (source: ResourceSource, params: Record<string, string>) => {
  switch (source) {
    case 'project':
      return params.projectId ?? null;
    case 'milestone':
      return milestoneRepository.getProjectId(params.milestoneId);
    case 'evidence':
      return evidenceRepository.getProjectId(params.evidenceId);
    case 'snapshot':
      return snapshotRepository.getProjectId(params.snapshotId);
    default:
      return null;
  }
};

export const requireProjectAccess = (source: ResourceSource = 'project'): RequestHandler => {
  return async (req, _res, next) => {
    if (!req.auth) {
      return next(new AppError(401, 'Authentication required', 'UNAUTHORIZED'));
    }

    const projectId = await resolveProjectId(source, req.params as Record<string, string>);
    if (!projectId) {
      return next(new AppError(404, 'Project not found', 'NOT_FOUND'));
    }

    const isOwner = await projectRepository.isOwner(projectId, req.auth.userId);
    if (isOwner) {
      return next();
    }

    const member = await projectMemberRepository.findMember(projectId, req.auth.userId);
    if (!member) {
      return next(new AppError(403, 'Forbidden', 'FORBIDDEN'));
    }

    return next();
  };
};

export const requireReviewerAccess = (source: ResourceSource = 'project'): RequestHandler => {
  return async (req, _res, next) => {
    if (!req.auth) {
      return next(new AppError(401, 'Authentication required', 'UNAUTHORIZED'));
    }

    if (req.auth.role !== UserRole.REVIEWER) {
      return next(new AppError(403, 'Reviewer access required', 'FORBIDDEN'));
    }

    const projectId = await resolveProjectId(source, req.params as Record<string, string>);
    if (!projectId) {
      return next(new AppError(404, 'Project not found', 'NOT_FOUND'));
    }

    const member = await projectMemberRepository.findMember(projectId, req.auth.userId);
    if (!member || member.role !== ProjectMemberRole.REVIEWER) {
      return next(new AppError(403, 'Reviewer access required', 'FORBIDDEN'));
    }

    return next();
  };
};
