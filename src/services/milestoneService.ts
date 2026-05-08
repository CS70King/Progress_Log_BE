import { MilestoneStatus } from '@prisma/client';
import { presentEvidenceItem, presentMilestone, presentMilestoneReview } from '../models/presenters';
import { milestoneRepository } from '../repositories/milestoneRepository';
import { AppError } from '../utils/appError';
import { parseDateOnly } from '../utils/dates';
import { logger } from '../utils/logger';
import { accessService } from './accessService';
import { UserRole } from '@prisma/client';
import { env } from '../config/env';
import { storage } from '../storage';
import { fromEvidenceType } from '../utils/enums';

const editableMilestoneStatuses: MilestoneStatus[] = [MilestoneStatus.DRAFT, MilestoneStatus.NEEDS_REVISION];

const ensureMilestoneEditable = (status: MilestoneStatus) => {
  if (!editableMilestoneStatuses.includes(status)) {
    logger.warn('milestone.editable_check.denied', {
      status
    });
    throw new AppError(409, 'Milestone is not editable in its current state', 'CONFLICT');
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
    await accessService.assertProjectOwner(projectId, userId);

    const milestone = await milestoneRepository.create({
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

    logger.info('milestone.create.service.created', {
      milestoneId: milestone.id,
      projectId,
      userId
    });
    return presentMilestone(milestone);
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
    return milestones.map((milestone) => {
      const presented = presentMilestone(milestone);
      const status = role === UserRole.REVIEWER && presented.status === 'submitted' ? 'pending_review' : presented.status;
      return {
        ...presented,
        status,
      review: milestone.review ? presentMilestoneReview(milestone.review) : null,
      evidence: milestone.evidenceItems.map((item) => presentEvidenceItem(item))
      };
    });
  },

  async getMilestone(milestoneId: string, userId: string, role: UserRole) {
    logger.info('milestone.get.service.start', {
      milestoneId,
      userId
    });
    const milestone = await accessService.assertMilestoneAccess(milestoneId, userId);

    const presented = presentMilestone(milestone);
    const status = role === UserRole.REVIEWER && presented.status === 'submitted' ? 'pending_review' : presented.status;

    // Generate signed URLs for evidence items
    const evidenceItems = await Promise.all(
      milestone.evidenceItems.map(async (item) => {
        const signed = await (async () => {
          try {
            return await storage.signEvidenceUrl(
              env.SUPABASE_STORAGE_BUCKET,
              item.filePath,
              env.SIGNED_URL_TTL_SECONDS
            );
          } catch (error) {
            logger.warn('milestone.get.service.evidence_sign_failed', {
              milestoneId,
              evidenceId: item.id,
              filePath: item.filePath
            });
            return null;
          }
        })();

        return {
          id: item.id,
          project_id: item.projectId,
          milestone_id: item.milestoneId,
          uploader: item.uploader
            ? {
                id: item.uploader.id,
                name: item.uploader.name,
                phone: item.uploader.phone,
                country: item.uploader.country,
                company: item.uploader.company
              }
            : null,
          evidence_type: fromEvidenceType(item.evidenceType),
          file_path: item.filePath,
          original_filename: item.originalFilename,
          content_type: item.contentType,
          size_bytes: Number(item.sizeBytes),
          created_at: item.createdAt.toISOString(),
          signed_url: signed?.url ?? null,
          signed_url_expires_at: signed?.expiresAt ?? null
        };
      })
    );

    return {
      milestone: {
        ...presented,
        status
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
    return presentMilestone(updatedMilestone);
  },

  async submitMilestone(milestoneId: string, userId: string) {
    logger.info('milestone.submit.service.start', {
      milestoneId,
      userId
    });
    const milestone = await accessService.assertMilestoneOwner(milestoneId, userId);
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
    return presentMilestone(updatedMilestone);
  }
};
