import {
  EvidenceType,
  MilestoneStatus,
  ProjectMemberRole,
  ProjectType,
  ReviewDecision,
  ShareResourceType,
  UserRole
} from '@prisma/client';

export const toUserRole = (value: 'worker' | 'reviewer'): UserRole =>
  value === 'worker' ? UserRole.WORKER : UserRole.REVIEWER;

export const fromUserRole = (value: UserRole) => value.toLowerCase() as 'worker' | 'reviewer';

export const toProjectType = (value: 'generic' | 'construction' | 'service'): ProjectType => {
  if (value === 'generic') {
    return ProjectType.GENERIC;
  }

  if (value === 'construction') {
    return ProjectType.CONSTRUCTION;
  }

  return ProjectType.SERVICE;
};

export const fromProjectType = (value: ProjectType) =>
  value.toLowerCase() as 'generic' | 'construction' | 'service';

export const fromProjectMemberRole = (value: ProjectMemberRole) =>
  value.toLowerCase() as 'owner' | 'reviewer';

export const toEvidenceType = (
  value: 'photo' | 'video' | 'document' | 'receipt' | 'other'
): EvidenceType => {
  switch (value) {
    case 'photo':
      return EvidenceType.PHOTO;
    case 'video':
      return EvidenceType.VIDEO;
    case 'document':
      return EvidenceType.DOCUMENT;
    case 'receipt':
      return EvidenceType.RECEIPT;
    default:
      return EvidenceType.OTHER;
  }
};

export const fromEvidenceType = (value: EvidenceType) =>
  value.toLowerCase() as 'photo' | 'video' | 'document' | 'receipt' | 'other';

export const fromMilestoneStatus = (value: MilestoneStatus) =>
  value.toLowerCase() as 'draft' | 'submitted' | 'approved' | 'needs_revision';

export const toReviewDecision = (value: 'approved' | 'needs_revision'): ReviewDecision =>
  value === 'approved' ? ReviewDecision.APPROVED : ReviewDecision.NEEDS_REVISION;

export const fromReviewDecision = (value: ReviewDecision) =>
  value.toLowerCase() as 'approved' | 'needs_revision';

export const toShareResourceType = (value: 'project' | 'snapshot'): ShareResourceType =>
  value === 'project' ? ShareResourceType.PROJECT : ShareResourceType.SNAPSHOT;
