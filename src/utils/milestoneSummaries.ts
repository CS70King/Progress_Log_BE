import { EvidenceType, MilestoneStatus, UserRole } from '@prisma/client';

export type EvidenceSummary = {
  photos: number;
  videos: number;
  documents: number;
  total: number;
};

type EvidenceItemLike = {
  evidenceType: EvidenceType;
};

type MilestoneActivityLike = {
  submittedAt: Date | null;
  updatedAt: Date;
};

type MilestoneSummaryLike = MilestoneActivityLike & {
  status: MilestoneStatus;
  evidenceItems: EvidenceItemLike[];
};

export const buildEvidenceSummary = (evidenceItems: EvidenceItemLike[] = []): EvidenceSummary => {
  let photos = 0;
  let videos = 0;
  let documents = 0;

  for (const item of evidenceItems) {
    if (item.evidenceType === EvidenceType.PHOTO) {
      photos += 1;
    } else if (item.evidenceType === EvidenceType.VIDEO) {
      videos += 1;
    } else {
      documents += 1;
    }
  }

  return {
    photos,
    videos,
    documents,
    total: photos + videos + documents
  };
};

const milestoneActivityAt = (milestone: MilestoneActivityLike): Date => {
  if (!milestone.submittedAt) {
    return milestone.updatedAt;
  }

  return milestone.submittedAt > milestone.updatedAt ? milestone.submittedAt : milestone.updatedAt;
};

const isVisibleToRole = (status: MilestoneStatus, role: UserRole) =>
  role === UserRole.WORKER || status !== MilestoneStatus.DRAFT;

export const buildMilestonesInfoFromRecords = (
  milestones: MilestoneSummaryLike[],
  role: UserRole
) => {
  const visible = milestones.filter((milestone) => isVisibleToRole(milestone.status, role));

  const draft = milestones.filter((m) => m.status === MilestoneStatus.DRAFT).length;
  const submitted = milestones.filter((m) => m.status === MilestoneStatus.SUBMITTED).length;
  const approved = milestones.filter((m) => m.status === MilestoneStatus.APPROVED).length;
  const needsRevision = milestones.filter((m) => m.status === MilestoneStatus.NEEDS_REVISION).length;
  const disapproved = milestones.filter((m) => m.status === MilestoneStatus.DISAPPROVED).length;

  const breakdown =
    role === UserRole.REVIEWER
      ? {
          pending_review: submitted,
          approved,
          disapproved: needsRevision + disapproved
        }
      : {
          draft,
          submitted,
          approved,
          needs_revision: needsRevision,
          disapproved
        };

  let lastActivityAt: string | null = null;
  let photos = 0;
  let videos = 0;
  let documents = 0;

  for (const milestone of visible) {
    const activityIso = milestoneActivityAt(milestone).toISOString();
    if (!lastActivityAt || activityIso > lastActivityAt) {
      lastActivityAt = activityIso;
    }

    for (const item of milestone.evidenceItems) {
      if (item.evidenceType === EvidenceType.PHOTO) {
        photos += 1;
      } else if (item.evidenceType === EvidenceType.VIDEO) {
        videos += 1;
      } else {
        documents += 1;
      }
    }
  }

  return {
    total: visible.length,
    breakdown,
    last_activity_at: lastActivityAt,
    evidence: { photos, videos, documents }
  };
};
