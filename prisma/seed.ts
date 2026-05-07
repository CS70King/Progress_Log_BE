import { PrismaPg } from '@prisma/adapter-pg';
import {
  MilestoneStatus,
  PrismaClient,
  ProjectMemberRole,
  ProjectType,
  ReviewDecision,
  UserRole
} from '@prisma/client';
import { env } from '../src/config/env';
import { hashPin } from '../src/utils/password';

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL
});

const prisma = new PrismaClient({ adapter });

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

const clearDatabase = async () => {
  await prisma.shareLink.deleteMany();
  await prisma.snapshot.deleteMany();
  await prisma.evidenceItem.deleteMany();
  await prisma.milestoneReview.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
};

async function main() {
  await clearDatabase();

  const worker = await prisma.user.create({
    data: {
      name: 'Worker One',
      phone: '+15555550100',
      country: 'United States',
      company: 'Progress Co',
      role: UserRole.WORKER,
      passwordHash: await hashPin('1234')
    }
  });

  const reviewer = await prisma.user.create({
    data: {
      name: 'Reviewer One',
      phone: '+15555550200',
      country: 'United States',
      company: 'Review Co',
      role: UserRole.REVIEWER,
      passwordHash: await hashPin('1234')
    }
  });

  const project = await prisma.project.create({
    data: {
      ownerId: worker.id,
      title: 'Demo Project',
      description: 'Seeded project for Progress Log',
      projectType: ProjectType.CONSTRUCTION,
      dedupeKey: buildProjectDedupeKey(worker.id, 'Demo Project', 'construction', [reviewer.id])
    }
  });

  await prisma.projectMember.createMany({
    data: [
      {
        projectId: project.id,
        userId: worker.id,
        role: ProjectMemberRole.OWNER
      },
      {
        projectId: project.id,
        userId: reviewer.id,
        role: ProjectMemberRole.REVIEWER
      }
    ]
  });

  const draftMilestone = await prisma.milestone.create({
    data: {
      projectId: project.id,
      createdBy: worker.id,
      title: 'Foundation work',
      description: 'Foundation excavation completed',
      activityDate: new Date('2026-03-01T00:00:00.000Z'),
      status: MilestoneStatus.DRAFT
    }
  });

  const submittedMilestone = await prisma.milestone.create({
    data: {
      projectId: project.id,
      createdBy: worker.id,
      title: 'Framing',
      description: 'Framing submitted for review',
      activityDate: new Date('2026-03-05T00:00:00.000Z'),
      status: MilestoneStatus.SUBMITTED,
      submittedAt: new Date('2026-03-06T00:00:00.000Z')
    }
  });

  const approvedMilestone = await prisma.milestone.create({
    data: {
      projectId: project.id,
      createdBy: worker.id,
      title: 'Roofing',
      description: 'Roofing approved',
      activityDate: new Date('2026-03-10T00:00:00.000Z'),
      status: MilestoneStatus.APPROVED,
      submittedAt: new Date('2026-03-11T00:00:00.000Z')
    }
  });

  const revisionMilestone = await prisma.milestone.create({
    data: {
      projectId: project.id,
      createdBy: worker.id,
      title: 'Inspection',
      description: 'Inspection needs revision',
      activityDate: new Date('2026-03-15T00:00:00.000Z'),
      status: MilestoneStatus.NEEDS_REVISION,
      submittedAt: new Date('2026-03-16T00:00:00.000Z')
    }
  });

  await prisma.milestoneReview.createMany({
    data: [
      {
        milestoneId: approvedMilestone.id,
        reviewerId: reviewer.id,
        decision: ReviewDecision.APPROVED,
        note: 'Approved',
        reviewedAt: new Date('2026-03-11T12:00:00.000Z')
      },
      {
        milestoneId: revisionMilestone.id,
        reviewerId: reviewer.id,
        decision: ReviewDecision.NEEDS_REVISION,
        note: 'Please add additional inspection photos',
        reviewedAt: new Date('2026-03-16T12:00:00.000Z')
      }
    ]
  });

  console.log({
    workerPhone: worker.phone,
    reviewerPhone: reviewer.phone,
    projectId: project.id,
    draftMilestoneId: draftMilestone.id,
    submittedMilestoneId: submittedMilestone.id
  });
}

void main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
