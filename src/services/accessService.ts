import { ProjectMemberRole } from '@prisma/client';
import { milestoneRepository } from '../repositories/milestoneRepository';
import { projectMemberRepository } from '../repositories/projectMemberRepository';
import { projectRepository } from '../repositories/projectRepository';
import { snapshotRepository } from '../repositories/snapshotRepository';
import { AppError } from '../utils/appError';
import { logger } from '../utils/logger';

const ensureProjectExists = async (projectId: string) => {
  const project = await projectRepository.findByIdBasic(projectId);
  if (!project) {
    logger.warn('access.project.not_found', {
      projectId
    });
    throw new AppError(404, 'Project not found', 'NOT_FOUND');
  }

  return project;
};

export const accessService = {
  async assertProjectAccess(projectId: string, userId: string) {
    logger.debug('access.project.check', {
      projectId,
      userId
    });
    const project = await ensureProjectExists(projectId);
    if (project.ownerId === userId) {
      logger.debug('access.project.granted_owner', {
        projectId,
        userId
      });
      return project;
    }

    const member = await projectMemberRepository.findMember(projectId, userId);
    if (!member) {
      logger.warn('access.project.denied', {
        projectId,
        userId
      });
      throw new AppError(403, 'Forbidden', 'FORBIDDEN');
    }

    logger.debug('access.project.granted_member', {
      projectId,
      userId,
      role: member.role
    });
    return project;
  },

  async assertProjectOwner(projectId: string, userId: string) {
    logger.debug('access.project_owner.check', {
      projectId,
      userId
    });
    const project = await ensureProjectExists(projectId);
    if (project.ownerId !== userId) {
      logger.warn('access.project_owner.denied', {
        projectId,
        userId,
        ownerId: project.ownerId
      });
      throw new AppError(403, 'Owner access required', 'FORBIDDEN');
    }

    logger.debug('access.project_owner.granted', {
      projectId,
      userId
    });
    return project;
  },

  async assertProjectReviewer(projectId: string, userId: string) {
    logger.debug('access.project_reviewer.check', {
      projectId,
      userId
    });
    await ensureProjectExists(projectId);
    const membership = await projectMemberRepository.findMember(projectId, userId);
    if (!membership || membership.role !== ProjectMemberRole.REVIEWER) {
      logger.warn('access.project_reviewer.denied', {
        projectId,
        userId,
        role: membership?.role ?? null
      });
      throw new AppError(403, 'Reviewer access required', 'FORBIDDEN');
    }

    logger.debug('access.project_reviewer.granted', {
      projectId,
      userId
    });
    return membership;
  },

  async assertMilestoneAccess(milestoneId: string, userId: string) {
    logger.debug('access.milestone.check', {
      milestoneId,
      userId
    });
    const milestone = await milestoneRepository.findById(milestoneId);
    if (!milestone) {
      logger.warn('access.milestone.not_found', {
        milestoneId
      });
      throw new AppError(404, 'Milestone not found', 'NOT_FOUND');
    }

    await this.assertProjectAccess(milestone.projectId, userId);
    return milestone;
  },

  async assertMilestoneOwner(milestoneId: string, userId: string) {
    logger.debug('access.milestone_owner.check', {
      milestoneId,
      userId
    });
    const milestone = await milestoneRepository.findById(milestoneId);
    if (!milestone) {
      logger.warn('access.milestone_owner.not_found', {
        milestoneId
      });
      throw new AppError(404, 'Milestone not found', 'NOT_FOUND');
    }

    await this.assertProjectOwner(milestone.projectId, userId);
    return milestone;
  },

  async assertSnapshotAccess(snapshotId: string, userId: string) {
    logger.debug('access.snapshot.check', {
      snapshotId,
      userId
    });
    const snapshot = await snapshotRepository.findById(snapshotId);
    if (!snapshot) {
      logger.warn('access.snapshot.not_found', {
        snapshotId
      });
      throw new AppError(404, 'Snapshot not found', 'NOT_FOUND');
    }

    await this.assertProjectAccess(snapshot.projectId, userId);
    return snapshot;
  },

  async assertSnapshotOwner(snapshotId: string, userId: string) {
    logger.debug('access.snapshot_owner.check', {
      snapshotId,
      userId
    });
    const snapshot = await snapshotRepository.findById(snapshotId);
    if (!snapshot) {
      logger.warn('access.snapshot_owner.not_found', {
        snapshotId
      });
      throw new AppError(404, 'Snapshot not found', 'NOT_FOUND');
    }

    await this.assertProjectOwner(snapshot.projectId, userId);
    return snapshot;
  }
};
