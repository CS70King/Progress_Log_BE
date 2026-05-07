import { MilestoneStatus } from '@prisma/client';
import { prisma } from '../db/prisma';
import { presentMilestone, presentMilestoneReview } from '../models/presenters';
import { AppError } from '../utils/appError';
import { toReviewDecision } from '../utils/enums';
import { logger } from '../utils/logger';
import { accessService } from './accessService';

export const reviewService = {
  async reviewMilestone(
    milestoneId: string,
    userId: string,
    input: {
      decision: 'approved' | 'needs_revision';
      note?: string;
    }
  ) {
    logger.info('review.create.service.start', {
      milestoneId,
      userId,
      decision: input.decision
    });
    const milestone = await accessService.assertMilestoneAccess(milestoneId, userId);
    await accessService.assertProjectReviewer(milestone.projectId, userId);

    if (milestone.status !== MilestoneStatus.SUBMITTED) {
      logger.warn('review.create.service.invalid_status', {
        milestoneId,
        userId,
        status: milestone.status
      });
      throw new AppError(409, 'Milestone must be submitted before review', 'CONFLICT');
    }

    const nextStatus =
      input.decision === 'approved' ? MilestoneStatus.APPROVED : MilestoneStatus.NEEDS_REVISION;

    const result = await prisma.$transaction(async (tx) => {
      const updatedMilestone = await tx.milestone.update({
        where: {
          id: milestoneId
        },
        data: {
          status: nextStatus
        },
        include: {
          creator: true
        }
      });

      const review = await tx.milestoneReview.upsert({
        where: {
          milestoneId
        },
        create: {
          milestoneId,
          reviewerId: userId,
          decision: toReviewDecision(input.decision),
          note: input.note,
          reviewedAt: new Date()
        },
        update: {
          reviewerId: userId,
          decision: toReviewDecision(input.decision),
          note: input.note,
          reviewedAt: new Date()
        },
        include: {
          reviewer: true
        }
      });

      return {
        milestone: updatedMilestone,
        review
      };
    });

    logger.info('review.create.service.completed', {
      milestoneId,
      reviewerId: userId,
      previousStatus: milestone.status,
      nextStatus,
      reviewId: result.review.id
    });
    return {
      milestone: presentMilestone(result.milestone),
      review: presentMilestoneReview(result.review)
    };
  }
};
