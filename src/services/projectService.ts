import { ProjectMemberRole, ProjectState, UserRole, MilestoneStatus } from '@prisma/client';
import { prisma } from '../db/prisma';
import { presentProject, presentSnapshot } from '../models/presenters';
import { milestoneRepository } from '../repositories/milestoneRepository';
import { projectMemberRepository } from '../repositories/projectMemberRepository';
import { projectRepository } from '../repositories/projectRepository';
import { snapshotRepository } from '../repositories/snapshotRepository';
import { userRepository } from '../repositories/userRepository';
import { storage } from '../storage';
import { AppError } from '../utils/appError';
import { toProjectType } from '../utils/enums';
import { logger, maskPhone } from '../utils/logger';
import { env } from '../config/env';
import { accessService } from './accessService';
import { authService } from './authService';

const getMilestoneInfo = async (projectId: string, role: UserRole) => {
  const milestones = await prisma.milestone.groupBy({
    by: ['status'],
    where: { projectId },
    _count: true
  });

  const draft = milestones.find((m) => m.status === MilestoneStatus.DRAFT)?._count || 0;
  const submitted = milestones.find((m) => m.status === MilestoneStatus.SUBMITTED)?._count || 0;
  const approved = milestones.find((m) => m.status === MilestoneStatus.APPROVED)?._count || 0;
  const needsRevision = milestones.find((m) => m.status === MilestoneStatus.NEEDS_REVISION)?._count || 0;
  const disapprovedRaw = milestones.find((m) => m.status === MilestoneStatus.DISAPPROVED)?._count || 0;

  const total =
    role === UserRole.REVIEWER
      ? // reviewers don't care about drafts in summaries
        submitted + approved + needsRevision + disapprovedRaw
      : draft + submitted + approved + needsRevision + disapprovedRaw;

  const breakdown =
    role === UserRole.REVIEWER
      ? {
          pending_review: submitted,
          approved,
          disapproved: needsRevision + disapprovedRaw
        }
      : {
          draft,
          submitted,
          approved,
          needs_revision: needsRevision,
          disapproved: disapprovedRaw
        };

  return {
    total,
    breakdown
  };
};

const formatProject = async (project: Awaited<ReturnType<typeof projectRepository.findById>>, role: UserRole) => {
  if (!project) {
    throw new AppError(404, 'Project not found', 'NOT_FOUND');
  }

  const { owner_id: _ownerId, ...projectResponse } = presentProject(project);

  const milestonesInfo = await getMilestoneInfo(project.id, role);

  return {
    ...projectResponse,
    milestonesInfo
  };
};

const formatProjectDetails = async (project: Awaited<ReturnType<typeof projectRepository.findById>>) => {
  if (!project) {
    throw new AppError(404, 'Project not found', 'NOT_FOUND');
  }

  const base = presentProject(project);

  const reviewerCount = project.members.filter((m) => m.role === ProjectMemberRole.REVIEWER).length;

  const milestones = await milestoneRepository.listByProject(project.id);
  const milestonesWithEvidenceUrls = await Promise.all(
    milestones.map(async (milestone) => {
      const evidence = await Promise.all(
        milestone.evidenceItems.map(async (item) => {
          const signed = await (async () => {
            try {
              return await storage.signEvidenceUrl(
                env.SUPABASE_STORAGE_BUCKET,
                item.filePath,
                env.SIGNED_URL_TTL_SECONDS
              );
            } catch (error) {
              logger.warn('project.get.service.evidence_sign_failed', {
                projectId: project.id,
                milestoneId: milestone.id,
                evidenceId: item.id,
                filePath: item.filePath
              });
              return null;
            }
          })();
          return {
            id: item.id,
            evidence_type: item.evidenceType.toLowerCase(),
            file_path: item.filePath,
            original_filename: item.originalFilename,
            content_type: item.contentType,
            size_bytes: Number(item.sizeBytes),
            created_at: item.createdAt.toISOString(),
            uploader: item.uploader
              ? {
                  id: item.uploader.id,
                  name: item.uploader.name,
                  phone: item.uploader.phone,
                  country: item.uploader.country,
                  company: item.uploader.company
                }
              : null,
            signed_url: signed?.url ?? null,
            signed_url_expires_at: signed?.expiresAt ?? null
          };
        })
      );

      return {
        id: milestone.id,
        title: milestone.title,
        description: milestone.description,
        activity_date: milestone.activityDate.toISOString().slice(0, 10),
        state: milestone.status.toLowerCase(),
        submitted_at: milestone.submittedAt?.toISOString() ?? null,
        created_at: milestone.createdAt.toISOString(),
        updated_at: milestone.updatedAt.toISOString(),
        creator: milestone.creator
          ? {
              id: milestone.creator.id,
              name: milestone.creator.name,
              phone: milestone.creator.phone,
              country: milestone.creator.country,
              company: milestone.creator.company
            }
          : null,
        review: milestone.review
          ? {
              decision: milestone.review.decision.toLowerCase(),
              note: milestone.review.note ?? null,
              reviewed_at: milestone.review.reviewedAt.toISOString(),
              reviewer: milestone.review.reviewer
                ? {
                    id: milestone.review.reviewer.id,
                    name: milestone.review.reviewer.name,
                    phone: milestone.review.reviewer.phone,
                    country: milestone.review.reviewer.country,
                    company: milestone.review.reviewer.company
                  }
                : null
            }
          : null,
        evidence
      };
    })
  );

  const snapshots = await snapshotRepository.listByProject(project.id);

  return {
    id: base.id,
    title: base.title,
    type: base.project_type,
    state: base.state,
    created_at: base.created_at,
    updated_at: base.updated_at,
    reviewer_count: reviewerCount,
    milestones: milestonesWithEvidenceUrls,
    snapshots: snapshots.map((snapshot) => presentSnapshot(snapshot))
  };
};

const formatProjectReviewerDetails = async (project: Awaited<ReturnType<typeof projectRepository.findById>>) => {
  if (!project) {
    throw new AppError(404, 'Project not found', 'NOT_FOUND');
  }

  const base = presentProject(project);
  const milestonesInfo = await getMilestoneInfo(project.id, UserRole.REVIEWER);

  const milestones = await milestoneRepository.listByProject(project.id);
  const visibleMilestones = milestones.filter((m) => m.status !== MilestoneStatus.DRAFT);

  const milestonesWithEvidenceUrls = await Promise.all(
    visibleMilestones.map(async (milestone) => {
      const evidence = await Promise.all(
        milestone.evidenceItems.map(async (item) => {
          const signed = await (async () => {
            try {
              return await storage.signEvidenceUrl(
                env.SUPABASE_STORAGE_BUCKET,
                item.filePath,
                env.SIGNED_URL_TTL_SECONDS
              );
            } catch (_error) {
              logger.warn('project.get.reviewer.evidence_sign_failed', {
                projectId: project.id,
                milestoneId: milestone.id,
                evidenceId: item.id,
                filePath: item.filePath
              });
              return null;
            }
          })();

          return {
            id: item.id,
            evidence_type: item.evidenceType.toLowerCase(),
            file_path: item.filePath,
            original_filename: item.originalFilename,
            content_type: item.contentType,
            size_bytes: Number(item.sizeBytes),
            created_at: item.createdAt.toISOString(),
            uploader: item.uploader
              ? {
                  id: item.uploader.id,
                  name: item.uploader.name,
                  phone: item.uploader.phone,
                  country: item.uploader.country,
                  company: item.uploader.company
                }
              : null,
            signed_url: signed?.url ?? null,
            signed_url_expires_at: signed?.expiresAt ?? null
          };
        })
      );

      return {
        id: milestone.id,
        title: milestone.title,
        description: milestone.description,
        activity_date: milestone.activityDate.toISOString().slice(0, 10),
        state: milestone.status === MilestoneStatus.SUBMITTED ? 'pending_review' : milestone.status.toLowerCase(),
        submitted_at: milestone.submittedAt?.toISOString() ?? null,
        created_at: milestone.createdAt.toISOString(),
        updated_at: milestone.updatedAt.toISOString(),
        review: milestone.review
          ? {
              decision: milestone.review.decision.toLowerCase(),
              note: milestone.review.note ?? null,
              reviewed_at: milestone.review.reviewedAt.toISOString(),
              reviewer: milestone.review.reviewer
                ? {
                    id: milestone.review.reviewer.id,
                    name: milestone.review.reviewer.name,
                    phone: milestone.review.reviewer.phone,
                    country: milestone.review.reviewer.country,
                    company: milestone.review.reviewer.company
                  }
                : null
            }
          : null,
        evidence
      };
    })
  );

  return {
    id: base.id,
    title: base.title,
    description: base.description ?? null,
    type: base.project_type,
    state: base.state,
    created_at: base.created_at,
    updated_at: base.updated_at,
    milestonesInfo,
    milestones: milestonesWithEvidenceUrls
  };
};

const normalizeProjectTitle = (title: string) => title.trim().toLowerCase().replace(/\s+/g, ' ');

const buildProjectDedupeKey = (
  ownerId: string,
  title: string,
  projectType: 'generic' | 'construction' | 'service',
  reviewerIds: string[]
) => {
  const reviewerSet = [...new Set(reviewerIds)].sort().join(',');
  return [ownerId, normalizeProjectTitle(title), projectType, reviewerSet].join('|');
};

const reviewerPhonesFromInput = (input: { reviewer_phone?: string; reviewer_phones?: string[] }) => {
  return input.reviewer_phones ?? (input.reviewer_phone ? [input.reviewer_phone] : []);
};

const assertUniqueReviewerPhones = (reviewerPhones: string[]) => {
  if (reviewerPhones.length > 3) {
    logger.warn('project.reviewer_phones.too_many_denied', {
      reviewerCount: reviewerPhones.length
    });
    throw new AppError(400, 'A project can have at most 3 reviewers', 'VALIDATION_ERROR');
  }

  const uniquePhones = new Set(reviewerPhones);
  if (uniquePhones.size !== reviewerPhones.length) {
    logger.warn('project.reviewer_phones.duplicate_denied', {
      reviewerCount: reviewerPhones.length,
      uniqueReviewerCount: uniquePhones.size
    });
    throw new AppError(400, 'Reviewer phone numbers must be unique', 'VALIDATION_ERROR');
  }
};

const assertProjectDedupeAvailable = async (dedupeKey: string, currentProjectId?: string) => {
  const existingProject = await projectRepository.findByDedupeKey(dedupeKey);
  if (existingProject && existingProject.id !== currentProjectId) {
    logger.warn('project.dedupe.denied', {
      existingProjectId: existingProject.id,
      currentProjectId: currentProjectId ?? null
    });
    throw new AppError(
      409,
      'A project with the same worker, reviewers, title, and type already exists',
      'CONFLICT'
    );
  }
};

export const projectService = {
  async createProject(
    userId: string,
    role: UserRole,
    input: {
      title: string;
      description?: string;
      project_type: 'generic' | 'construction' | 'service';
      reviewer_phone?: string;
      reviewer_phones?: string[];
    }
  ) {
    const reviewerPhones = reviewerPhonesFromInput(input);
    logger.info('project.create.service.start', {
      userId,
      role,
      projectType: input.project_type,
      reviewerPhones: reviewerPhones.map(maskPhone)
    });

    authService.ensureWorkerRole(role);
    const owner = await authService.assertActiveUser(userId);
    assertUniqueReviewerPhones(reviewerPhones);

    const reviewerIds: string[] = [];

    for (const reviewerPhone of reviewerPhones) {
      if (owner?.phone === reviewerPhone) {
        logger.warn('project.create.service.self_reviewer_denied', {
          userId,
          reviewerPhone: maskPhone(reviewerPhone)
        });
        throw new AppError(400, 'Worker cannot be their own reviewer', 'VALIDATION_ERROR');
      }

      const reviewer = await userRepository.findReviewerByPhone(reviewerPhone);
      if (!reviewer) {
        logger.warn('project.create.service.reviewer_not_found', {
          reviewerPhone: maskPhone(reviewerPhone)
        });
        throw new AppError(404, 'Reviewer not found', 'NOT_FOUND');
      }

      reviewerIds.push(reviewer.id);
      logger.info('project.create.service.reviewer_matched', {
        reviewerId: reviewer.id,
        reviewerPhone: maskPhone(reviewer.phone)
      });
    }

    const dedupeKey = buildProjectDedupeKey(userId, input.title, input.project_type, reviewerIds);
    await assertProjectDedupeAvailable(dedupeKey);

    const createdProject = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          ownerId: userId,
          title: input.title,
          description: input.description,
          projectType: toProjectType(input.project_type),
          dedupeKey
        }
      });

      await tx.projectMember.create({
        data: {
          projectId: project.id,
          userId,
          role: ProjectMemberRole.OWNER
        }
      });

      for (const reviewerId of reviewerIds) {
        await tx.projectMember.create({
          data: {
            projectId: project.id,
            userId: reviewerId,
            role: ProjectMemberRole.REVIEWER
          }
        });
      }

      return tx.project.findUnique({
        where: { id: project.id },
        include: {
          owner: true,
          members: {
            include: {
              user: true
            }
          }
        }
      });
    });

    logger.info('project.create.service.created', {
      projectId: createdProject?.id,
      ownerId: userId,
      reviewerIds
    });

    return formatProject(createdProject, role);
  },

  async listProjects(userId: string, role: UserRole) {
    logger.info('project.list.service.start', {
      userId,
      role
    });
    const projects = await projectRepository.findAccessibleProjects(userId);
    logger.info('project.list.service.found', {
      userId,
      count: projects.length
    });
    
    const formattedProjects = await Promise.all(
      projects.map((project) => formatProject(project, role))
    );
    
    // Group projects by state
    const groupedProjects: {
      active: typeof formattedProjects;
      completed: typeof formattedProjects;
      abandoned: typeof formattedProjects;
    } = {
      active: [],
      completed: [],
      abandoned: []
    };
    
    formattedProjects.forEach((project) => {
      switch (project.state) {
        case 'active':
          groupedProjects.active.push(project);
          break;
        case 'completed':
          groupedProjects.completed.push(project);
          break;
        case 'abandoned':
          groupedProjects.abandoned.push(project);
          break;
      }
    });
    
    return groupedProjects;
  },

  async getProject(projectId: string, userId: string, role: UserRole) {
    logger.info('project.get.service.start', {
      projectId,
      userId,
      role
    });
    await accessService.assertProjectAccess(projectId, userId);
    const project = await projectRepository.findById(projectId);
    if (role === UserRole.REVIEWER) {
      return formatProjectReviewerDetails(project);
    }
    return formatProjectDetails(project);
  },

  async completeProject(projectId: string, userId: string, role: UserRole) {
    logger.info('project.complete.service.start', {
      projectId,
      userId,
      role
    });
    authService.ensureWorkerRole(role);
    await accessService.assertProjectOwner(projectId, userId);

    const current = await projectRepository.findByIdBasic(projectId);
    if (!current) {
      throw new AppError(404, 'Project not found', 'NOT_FOUND');
    }
    if (current.state !== ProjectState.ACTIVE) {
      logger.warn('project.complete.service.invalid_state', {
        projectId,
        currentState: current.state
      });
      throw new AppError(409, 'Only active projects can be completed', 'CONFLICT');
    }

    await projectRepository.updateState(projectId, ProjectState.COMPLETED);
    const project = await projectRepository.findById(projectId);
    return formatProjectDetails(project);
  },

  async abandonProject(projectId: string, userId: string, role: UserRole) {
    logger.info('project.abandon.service.start', {
      projectId,
      userId,
      role
    });
    authService.ensureWorkerRole(role);
    await accessService.assertProjectOwner(projectId, userId);

    const current = await projectRepository.findByIdBasic(projectId);
    if (!current) {
      throw new AppError(404, 'Project not found', 'NOT_FOUND');
    }
    if (current.state !== ProjectState.ACTIVE) {
      logger.warn('project.abandon.service.invalid_state', {
        projectId,
        currentState: current.state
      });
      throw new AppError(409, 'Only active projects can be abandoned', 'CONFLICT');
    }

    await projectRepository.updateState(projectId, ProjectState.ABANDONED);
    const project = await projectRepository.findById(projectId);
    return formatProjectDetails(project);
  },

  async inviteReviewer(projectId: string, userId: string, reviewerPhone: string) {
    logger.info('project.invite_reviewer.service.start', {
      projectId,
      userId,
      reviewerPhone: maskPhone(reviewerPhone)
    });
    await accessService.assertProjectOwner(projectId, userId);

    const owner = await userRepository.findById(userId);
    if (owner?.phone === reviewerPhone) {
      logger.warn('project.invite_reviewer.service.self_reviewer_denied', {
        projectId,
        userId,
        reviewerPhone: maskPhone(reviewerPhone)
      });
      throw new AppError(400, 'Worker cannot be their own reviewer', 'VALIDATION_ERROR');
    }

    const reviewer = await userRepository.findReviewerByPhone(reviewerPhone);
    if (!reviewer) {
      logger.warn('project.invite_reviewer.service.reviewer_not_found', {
        projectId,
        reviewerPhone: maskPhone(reviewerPhone)
      });
      throw new AppError(404, 'Reviewer not found', 'NOT_FOUND');
    }

    const membership = await projectMemberRepository.findMember(projectId, reviewer.id);
    if (membership) {
      logger.warn('project.invite_reviewer.service.already_assigned', {
        projectId,
        reviewerId: reviewer.id
      });
      throw new AppError(409, 'Reviewer is already assigned to the project', 'CONFLICT');
    }

    const projectBeforeInvite = await projectRepository.findById(projectId);
    if (!projectBeforeInvite) {
      throw new AppError(404, 'Project not found', 'NOT_FOUND');
    }

    const reviewerIds = [
      ...projectBeforeInvite.members
      .filter((member) => member.role === ProjectMemberRole.REVIEWER)
      .map((member) => member.userId),
      reviewer.id
    ];

    if (reviewerIds.length > 3) {
      logger.warn('project.invite_reviewer.service.too_many_reviewers', {
        projectId,
        reviewerCount: reviewerIds.length
      });
      throw new AppError(400, 'A project can have at most 3 reviewers', 'VALIDATION_ERROR');
    }

    const dedupeKey = buildProjectDedupeKey(
      projectBeforeInvite.ownerId,
      projectBeforeInvite.title,
      projectBeforeInvite.projectType.toLowerCase() as 'generic' | 'construction' | 'service',
      reviewerIds
    );
    await assertProjectDedupeAvailable(dedupeKey, projectId);

    await projectMemberRepository.create(projectId, reviewer.id, ProjectMemberRole.REVIEWER);
    await projectRepository.updateDedupeKey(projectId, dedupeKey);

    logger.info('project.invite_reviewer.service.created_membership', {
      projectId,
      reviewerId: reviewer.id
    });
    const project = await projectRepository.findById(projectId);
    return formatProject(project, UserRole.WORKER);
  }
};
