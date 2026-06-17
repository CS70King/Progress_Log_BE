import { MilestoneStatus, ProjectState } from '@prisma/client';
import { presentMilestone, presentMilestoneReview } from '../models/presenters';
import { milestoneRepository } from '../repositories/milestoneRepository';
import { AppError } from '../utils/appError';
import { parseDateOnly } from '../utils/dates';
import { logger } from '../utils/logger';
import { cacheInvalidation } from '../helpers/cache/cacheInvalidation';
import { accessService } from './accessService';
import { UserRole } from '@prisma/client';
import { presentEvidenceItemWithSignedUrls } from '../utils/evidenceResponse';
import { buildEvidenceSummary } from '../utils/milestoneSummaries';
import { evidenceService } from './evidenceService';
import { notificationService } from './notificationService';

const editableMilestoneStatuses: MilestoneStatus[] = [MilestoneStatus.DRAFT, MilestoneStatus.NEEDS_REVISION];

const ensureMilestoneEditable = (status: MilestoneStatus) => {
  if (!editableMilestoneStatuses.includes(status)) {
    logger.warn('milestone.editable_check.denied', {
      status
    });
    throw new AppError(409, 'Milestone is not editable in its current state', 'CONFLICT');
  }
};

const ensureProjectActive = (projectState: ProjectState) => {
  if (projectState !== ProjectState.ACTIVE) {
    logger.warn('milestone.project_state.denied', {
      projectState
    });
    throw new AppError(409, 'Milestones cannot be changed for completed or abandoned projects', 'CONFLICT');
  }
};

const createMilestoneRecord = async (
  projectId: string,
  userId: string,
  input: {
    title: string;
    description: string;
    activity_date: string;
    tags?: string[];
  }
) => {
  const project = await accessService.assertProjectOwner(projectId, userId);
  ensureProjectActive(project.state);

  return milestoneRepository.create({
    project: {
      connect: {
        id: projectId
      }
    },
    creator: {
      connect: {
        id: userId
      }
    },
    title: input.title,
    description: input.description,
    activityDate: parseDateOnly(input.activity_date)
  });
};

const deleteMilestoneQuietly = async (milestoneId: string, projectId: string) => {
  try {
    await milestoneRepository.delete(milestoneId);
  } catch (error) {
    logger.warn('milestone.cleanup.delete_failed', {
      milestoneId,
      projectId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const milestoneService = {
  async createMilestone(
    projectId: string,
    userId: string,
    input: {
      title: string;
      description: string;
      activity_date: string;
      tags?: string[];
    }
  ) {
    logger.info('milestone.create.service.start', {
      projectId,
      userId,
      activityDate: input.activity_date
    });
    const milestone = await createMilestoneRecord(projectId, userId, input);

    logger.info('milestone.create.service.created', {
      milestoneId: milestone.id,
      projectId,
      userId
    });
    await cacheInvalidation.invalidateProjectDossier(projectId);
    return {
      ...presentMilestone(milestone),
      evidence_summary: buildEvidenceSummary()
    };
  },

  async createMilestoneWithEvidence(
    projectId: string,
    userId: string,
    role: UserRole,
    input: {
      title: string;
      description: string;
      activity_date: string;
      tags?: string[];
      evidence_type: 'photo' | 'video' | 'document';
    },
    files: Express.Multer.File[]
  ) {
    logger.info('milestone.create_with_evidence.service.start', {
      projectId,
      userId,
      activityDate: input.activity_date,
      fileCount: files.length,
      evidenceType: input.evidence_type
    });

    const milestone = await createMilestoneRecord(projectId, userId, input);

    try {
      await evidenceService.uploadEvidence(
        milestone.id,
        userId,
        {
          evidence_type: input.evidence_type
        },
        files
      );

      logger.info('milestone.create_with_evidence.service.completed', {
        milestoneId: milestone.id,
        projectId,
        userId,
        fileCount: files.length
      });
      return this.getMilestone(milestone.id, userId, role);
    } catch (error) {
      logger.warn('milestone.create_with_evidence.service.rollback_start', {
        milestoneId: milestone.id,
        projectId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      await deleteMilestoneQuietly(milestone.id, projectId);
      await cacheInvalidation.invalidateProjectDossier(projectId);
      throw error;
    }
  },

  async listMilestones(projectId: string, userId: string, role: UserRole) {
    logger.info('milestone.list.service.start', {
      projectId,
      userId
    });
    await accessService.assertProjectAccess(projectId, userId);
    const milestones = await milestoneRepository.listByProject(projectId);

    logger.info('milestone.list.service.found', {
      projectId,
      userId,
      count: milestones.length
    });
    return Promise.all(milestones.map(async (milestone) => {
      const presented = presentMilestone(milestone);
      const status = role === UserRole.REVIEWER && presented.status === 'submitted' ? 'pending_review' : presented.status;
      return {
        ...presented,
        status,
        evidence_summary: buildEvidenceSummary(milestone.evidenceItems),
        review: milestone.review ? presentMilestoneReview(milestone.review) : null,
        evidence: await Promise.all(
          milestone.evidenceItems.map((item) =>
            presentEvidenceItemWithSignedUrls(item, {
              signErrorEvent: 'milestone.list.service.evidence_sign_failed',
              thumbnailSignErrorEvent: 'milestone.list.service.thumbnail_sign_failed',
              context: {
                projectId,
                milestoneId: milestone.id
              }
            })
          )
        )
      };
    }));
  },

  async getMilestone(milestoneId: string, userId: string, role: UserRole) {
    logger.info('milestone.get.service.start', {
      milestoneId,
      userId
    });
    const milestone = await accessService.assertMilestoneAccess(milestoneId, userId);

    const presented = presentMilestone(milestone);
    const status = role === UserRole.REVIEWER && presented.status === 'submitted' ? 'pending_review' : presented.status;

    const evidenceItems = await Promise.all(
      milestone.evidenceItems.map((item) =>
        presentEvidenceItemWithSignedUrls(item, {
          signErrorEvent: 'milestone.get.service.evidence_sign_failed',
          thumbnailSignErrorEvent: 'milestone.get.service.thumbnail_sign_failed',
          context: {
            milestoneId,
            projectId: milestone.projectId
          }
        })
      )
    );

    return {
      milestone: {
        ...presented,
        status,
        evidence_summary: buildEvidenceSummary(milestone.evidenceItems)
      },
      evidence_items: evidenceItems,
      review: milestone.review ? presentMilestoneReview(milestone.review) : null
    };
  },

  async updateMilestone(
    milestoneId: string,
    userId: string,
    input: {
      title?: string;
      description?: string;
      activity_date?: string;
      tags?: string[];
    }
  ) {
    logger.info('milestone.update.service.start', {
      milestoneId,
      userId,
      fields: Object.keys(input)
    });
    const milestone = await accessService.assertMilestoneOwner(milestoneId, userId);
    ensureProjectActive(milestone.project.state);
    if (milestone.createdBy !== userId) {
      logger.warn('milestone.update.service.creator_check_denied', {
        milestoneId,
        userId,
        createdBy: milestone.createdBy
      });
      throw new AppError(403, 'Only the milestone creator can edit it', 'FORBIDDEN');
    }

    ensureMilestoneEditable(milestone.status);

    const updatedMilestone = await milestoneRepository.update(milestoneId, {
      ...(input.title ? { title: input.title } : {}),
      ...(input.description ? { description: input.description } : {}),
      ...(input.activity_date ? { activityDate: parseDateOnly(input.activity_date) } : {})
    });

    logger.info('milestone.update.service.updated', {
      milestoneId,
      status: updatedMilestone.status
    });
    await cacheInvalidation.invalidateProjectDossier(milestone.projectId);
    return {
      ...presentMilestone(updatedMilestone),
      evidence_summary: buildEvidenceSummary(updatedMilestone.evidenceItems)
    };
  },

  async submitMilestone(milestoneId: string, userId: string) {
    logger.info('milestone.submit.service.start', {
      milestoneId,
      userId
    });
    const milestone = await accessService.assertMilestoneOwner(milestoneId, userId);
    ensureProjectActive(milestone.project.state);
    ensureMilestoneEditable(milestone.status);

    const updatedMilestone = await milestoneRepository.update(milestoneId, {
      status: MilestoneStatus.SUBMITTED,
      submittedAt: new Date()
    });

    logger.info('milestone.submit.service.submitted', {
      milestoneId,
      previousStatus: milestone.status,
      nextStatus: updatedMilestone.status
    });
    await cacheInvalidation.invalidateProjectDossier(milestone.projectId);
    notificationService.notifyReviewersMilestoneSubmitted({
      projectId: milestone.projectId,
      projectTitle: milestone.project.title,
      milestoneId,
      milestoneTitle: updatedMilestone.title,
      workerName: milestone.creator.name
    });
    return {
      ...presentMilestone(updatedMilestone),
      evidence_summary: buildEvidenceSummary(updatedMilestone.evidenceItems)
    };
  }
};
