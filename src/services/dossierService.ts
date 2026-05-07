import { ProjectMemberRole } from '@prisma/client';
import { env } from '../config/env';
import { milestoneRepository } from '../repositories/milestoneRepository';
import { projectRepository } from '../repositories/projectRepository';
import { snapshotRepository } from '../repositories/snapshotRepository';
import { storage } from '../storage';
import { AppError } from '../utils/appError';
import { formatDateOnly } from '../utils/dates';
import {
  fromEvidenceType,
  fromMilestoneStatus,
  fromProjectType,
  fromReviewDecision
} from '../utils/enums';
import { logger } from '../utils/logger';
import { accessService } from './accessService';

type StoredEvidence = {
  id: string;
  evidence_type: 'photo' | 'video' | 'document' | 'receipt' | 'other';
  original_filename: string;
  content_type: string;
  size_bytes: number;
  file_path: string;
};

type StoredMilestone = {
  id: string;
  title: string;
  description: string;
  activity_date: string | null;
  status: 'draft' | 'submitted' | 'approved' | 'needs_revision';
  submitted_at: string | null;
  review: {
    decision: 'approved' | 'needs_revision';
    note: string | null;
    reviewer: { id: string; name: string };
    reviewed_at: string;
  } | null;
  evidence: StoredEvidence[];
  created_at: string;
  updated_at: string;
};

export type StoredProjectDossier = {
  header: {
    type: 'project';
    project: {
      id: string;
      title: string;
      description: string | null;
      project_type: 'generic' | 'construction' | 'service';
      created_at: string;
    };
    parties: {
      owner: { id: string; name: string; phone: string; company: string | null };
      reviewers: { id: string; name: string; phone: string; company: string | null }[];
    };
  };
  milestones: StoredMilestone[];
  generated_at: string;
};

export type StoredSnapshotDossier = {
  header: {
    type: 'snapshot';
    snapshot: {
      id: string;
      title: string;
      from_date: string | null;
      to_date: string | null;
      created_at: string;
    };
    project: {
      id: string;
      title: string;
      project_type: 'generic' | 'construction' | 'service';
    };
    parties: {
      owner: { id: string; name: string; phone: string; company: string | null };
      reviewers: { id: string; name: string; phone: string; company: string | null }[];
    };
  };
  milestones: StoredMilestone[];
  generated_at: string;
};

type ProjectWithMembers = NonNullable<Awaited<ReturnType<typeof projectRepository.findById>>>;
type MilestoneList = Awaited<ReturnType<typeof milestoneRepository.listByProject>>;

const buildMilestones = (milestones: MilestoneList): StoredMilestone[] => {
  return milestones.map((milestone) => ({
    id: milestone.id,
    title: milestone.title,
    description: milestone.description,
    activity_date: formatDateOnly(milestone.activityDate),
    status: fromMilestoneStatus(milestone.status),
    submitted_at: milestone.submittedAt?.toISOString() ?? null,
    review: milestone.review
      ? {
          decision: fromReviewDecision(milestone.review.decision),
          note: milestone.review.note,
          reviewer: {
            id: milestone.review.reviewer.id,
            name: milestone.review.reviewer.name
          },
          reviewed_at: milestone.review.reviewedAt.toISOString()
        }
      : null,
    evidence: milestone.evidenceItems.map((item) => ({
      id: item.id,
      evidence_type: fromEvidenceType(item.evidenceType),
      original_filename: item.originalFilename,
      content_type: item.contentType,
      size_bytes: Number(item.sizeBytes),
      file_path: item.filePath
    })),
    created_at: milestone.createdAt.toISOString(),
    updated_at: milestone.updatedAt.toISOString()
  }));
};

const reviewersFromProject = (project: ProjectWithMembers) => {
  return project.members
    .filter((member) => member.role === ProjectMemberRole.REVIEWER)
    .map((member) => ({
      id: member.user.id,
      name: member.user.name,
      phone: member.user.phone,
      company: member.user.company
    }));
};

const signMilestones = async (milestones: StoredMilestone[]) => {
  const evidenceCount = milestones.reduce((count, milestone) => count + milestone.evidence.length, 0);
  logger.info('dossier.sign_milestones.start', {
    milestoneCount: milestones.length,
    evidenceCount
  });

  return Promise.all(
    milestones.map(async (milestone) => ({
      id: milestone.id,
      title: milestone.title,
      description: milestone.description,
      activity_date: milestone.activity_date,
      status: milestone.status,
      submitted_at: milestone.submitted_at,
      review: milestone.review,
      evidence: await Promise.all(
        milestone.evidence.map(async (evidence) => {
          const signed = await (async () => {
            try {
              return await storage.signEvidenceUrl(
                env.SUPABASE_STORAGE_BUCKET,
                evidence.file_path,
                env.SIGNED_URL_TTL_SECONDS
              );
            } catch (_error) {
              logger.warn('dossier.sign_milestones.evidence_sign_failed', {
                milestoneId: milestone.id,
                evidenceId: evidence.id,
                filePath: evidence.file_path
              });
              return null;
            }
          })();

          return {
            id: evidence.id,
            evidence_type: evidence.evidence_type,
            original_filename: evidence.original_filename,
            content_type: evidence.content_type,
            size_bytes: evidence.size_bytes,
            file_url: signed?.url ?? null,
            file_expires_at: signed?.expiresAt ?? null
          };
        })
      ),
      created_at: milestone.created_at,
      updated_at: milestone.updated_at
    }))
  );
};

const getProjectOrThrow = async (projectId: string) => {
  const project = await projectRepository.findById(projectId);
  if (!project) {
    logger.warn('dossier.project.not_found', {
      projectId
    });
    throw new AppError(404, 'Project not found', 'NOT_FOUND');
  }

  return project;
};

export const dossierService = {
  async buildProjectImmutablePayload(projectId: string): Promise<StoredProjectDossier> {
    logger.info('dossier.project_payload.build_start', {
      projectId
    });
    const project = await getProjectOrThrow(projectId);
    const milestones = await milestoneRepository.listByProject(projectId);

    logger.info('dossier.project_payload.build_loaded', {
      projectId,
      milestoneCount: milestones.length
    });
    return {
      header: {
        type: 'project',
        project: {
          id: project.id,
          title: project.title,
          description: project.description,
          project_type: fromProjectType(project.projectType),
          created_at: project.createdAt.toISOString()
        },
        parties: {
          owner: {
            id: project.owner.id,
            name: project.owner.name,
            phone: project.owner.phone,
            company: project.owner.company
          },
          reviewers: reviewersFromProject(project)
        }
      },
      milestones: buildMilestones(milestones),
      generated_at: new Date().toISOString()
    };
  },

  async projectDossier(projectId: string, userId: string) {
    logger.info('dossier.project.service.start', {
      projectId,
      userId
    });
    await accessService.assertProjectAccess(projectId, userId);
    const payload = await this.buildProjectImmutablePayload(projectId);

    return {
      header: payload.header,
      milestones: await signMilestones(payload.milestones),
      generated_at: new Date().toISOString()
    };
  },

  async projectDossierForShare(projectId: string) {
    logger.info('dossier.project_share.service.start', {
      projectId
    });
    const payload = await this.buildProjectImmutablePayload(projectId);

    return {
      header: payload.header,
      milestones: await signMilestones(payload.milestones),
      generated_at: new Date().toISOString()
    };
  },

  async buildSnapshotImmutablePayload(
    project: ProjectWithMembers,
    snapshot: {
      id: string;
      title: string;
      fromDate: Date | null;
      toDate: Date | null;
      createdAt: Date;
    },
    milestones: MilestoneList
  ): Promise<StoredSnapshotDossier> {
    logger.info('dossier.snapshot_payload.build_start', {
      projectId: project.id,
      snapshotId: snapshot.id,
      milestoneCount: milestones.length
    });
    return {
      header: {
        type: 'snapshot',
        snapshot: {
          id: snapshot.id,
          title: snapshot.title,
          from_date: formatDateOnly(snapshot.fromDate),
          to_date: formatDateOnly(snapshot.toDate),
          created_at: snapshot.createdAt.toISOString()
        },
        project: {
          id: project.id,
          title: project.title,
          project_type: fromProjectType(project.projectType)
        },
        parties: {
          owner: {
            id: project.owner.id,
            name: project.owner.name,
            phone: project.owner.phone,
            company: project.owner.company
          },
          reviewers: reviewersFromProject(project)
        }
      },
      milestones: buildMilestones(milestones),
      generated_at: new Date().toISOString()
    };
  },

  async snapshotDossier(snapshotId: string, userId: string) {
    logger.info('dossier.snapshot.service.start', {
      snapshotId,
      userId
    });
    const snapshot = await accessService.assertSnapshotAccess(snapshotId, userId);
    const payload = snapshot.immutablePayload as StoredSnapshotDossier;

    const sortedMilestones = [...payload.milestones].sort((a, b) => {
      // Most recent first: activity_date (YYYY-MM-DD) desc, then created_at desc.
      const aDate = a.activity_date ?? '';
      const bDate = b.activity_date ?? '';
      if (aDate !== bDate) return aDate < bDate ? 1 : -1;
      return a.created_at < b.created_at ? 1 : -1;
    });

    return {
      project: {
        id: payload.header.project.id,
        title: payload.header.project.title
      },
      snapshot: {
        id: payload.header.snapshot.id,
        title: payload.header.snapshot.title,
        created_at: payload.header.snapshot.created_at,
        from_date: payload.header.snapshot.from_date,
        to_date: payload.header.snapshot.to_date
      },
      worker: {
        name: payload.header.parties.owner.name,
        phone: payload.header.parties.owner.phone,
        company: payload.header.parties.owner.company ?? null
      },
      reviewers: payload.header.parties.reviewers.map((reviewer) => ({
        name: reviewer.name,
        phone: reviewer.phone
      })),
      milestones: await signMilestones(sortedMilestones),
      generated_at: new Date().toISOString()
    };
  },

  async snapshotDossierForShare(snapshotId: string) {
    logger.info('dossier.snapshot_share.service.start', {
      snapshotId
    });
    const snapshot = await snapshotRepository.findById(snapshotId);
    if (!snapshot) {
      logger.warn('dossier.snapshot_share.service.not_found', {
        snapshotId
      });
      throw new AppError(404, 'Snapshot not found', 'NOT_FOUND');
    }

    const payload = snapshot.immutablePayload as StoredSnapshotDossier;
    const sortedMilestones = [...payload.milestones].sort((a, b) => {
      const aDate = a.activity_date ?? '';
      const bDate = b.activity_date ?? '';
      if (aDate !== bDate) return aDate < bDate ? 1 : -1;
      return a.created_at < b.created_at ? 1 : -1;
    });

    return {
      project: {
        id: payload.header.project.id,
        title: payload.header.project.title
      },
      snapshot: {
        id: payload.header.snapshot.id,
        title: payload.header.snapshot.title,
        created_at: payload.header.snapshot.created_at,
        from_date: payload.header.snapshot.from_date,
        to_date: payload.header.snapshot.to_date
      },
      worker: {
        name: payload.header.parties.owner.name,
        phone: payload.header.parties.owner.phone,
        company: payload.header.parties.owner.company ?? null
      },
      reviewers: payload.header.parties.reviewers.map((reviewer) => ({
        name: reviewer.name,
        phone: reviewer.phone
      })),
      milestones: await signMilestones(sortedMilestones),
      generated_at: new Date().toISOString()
    };
  }
};
