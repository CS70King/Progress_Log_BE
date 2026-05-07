import {
  EvidenceItem,
  Milestone,
  MilestoneReview,
  Project,
  ProjectMember,
  Snapshot,
  User
} from '@prisma/client';
import { formatDateOnly } from '../utils/dates';
import {
  fromEvidenceType,
  fromMilestoneStatus,
  fromProjectMemberRole,
  fromProjectType,
  fromReviewDecision,
  fromUserRole
} from '../utils/enums';

export const presentUser = (user: User) => ({
  id: user.id,
  role: fromUserRole(user.role),
  name: user.name,
  phone: user.phone,
  country: user.country,
  company: user.company,
  created_at: user.createdAt.toISOString()
});

export const presentProject = (project: Project & { state?: string }) => ({
  id: project.id,
  owner_id: project.ownerId,
  title: project.title,
  description: project.description,
  project_type: fromProjectType(project.projectType),
  state: project.state?.toLowerCase() || 'active',
  created_at: project.createdAt.toISOString(),
  updated_at: project.updatedAt.toISOString()
});

export const presentProjectMember = (member: ProjectMember & { user?: User }) => ({
  id: member.id,
  project_id: member.projectId,
  user_id: member.userId,
  role: fromProjectMemberRole(member.role),
  created_at: member.createdAt.toISOString(),
  ...(member.user
    ? {
        user: {
          id: member.user.id,
          name: member.user.name,
          phone: member.user.phone,
          company: member.user.company
        }
      }
    : {})
});

export const presentMilestone = (milestone: Milestone & { creator?: User | null }) => ({
  id: milestone.id,
  project_id: milestone.projectId,
  creator: milestone.creator
    ? {
        id: milestone.creator.id,
        name: milestone.creator.name,
        phone: milestone.creator.phone,
        country: milestone.creator.country,
        company: milestone.creator.company
      }
    : null,
  title: milestone.title,
  description: milestone.description,
  activity_date: formatDateOnly(milestone.activityDate),
  status: fromMilestoneStatus(milestone.status),
  submitted_at: milestone.submittedAt?.toISOString() ?? null,
  created_at: milestone.createdAt.toISOString(),
  updated_at: milestone.updatedAt.toISOString()
});

export const presentEvidenceItem = (item: EvidenceItem & { uploader?: User | null }) => ({
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
  created_at: item.createdAt.toISOString()
});

export const presentMilestoneReview = (review: MilestoneReview & { reviewer?: User | null }) => ({
  id: review.id,
  milestone_id: review.milestoneId,
  reviewer: review.reviewer
    ? {
        id: review.reviewer.id,
        name: review.reviewer.name,
        phone: review.reviewer.phone,
        country: review.reviewer.country,
        company: review.reviewer.company
      }
    : null,
  decision: fromReviewDecision(review.decision),
  note: review.note,
  reviewed_at: review.reviewedAt.toISOString()
});

export const presentSnapshot = (snapshot: Snapshot & { _count?: { milestones: number } }) => ({
  id: snapshot.id,
  project_id: snapshot.projectId,
  created_by: snapshot.createdBy,
  title: snapshot.title,
  milestone_count: snapshot._count?.milestones || 0,
  created_at: snapshot.createdAt.toISOString()
});
