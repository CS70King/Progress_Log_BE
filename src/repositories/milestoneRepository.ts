import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';

export const milestoneRepository = {
  create(data: Prisma.MilestoneCreateInput) {
    return prisma.milestone.create({
      data,
      include: {
        creator: true
      }
    });
  },

  listByProject(projectId: string) {
    return prisma.milestone.findMany({
      where: { projectId },
      include: {
        creator: true,
        evidenceItems: {
          include: {
            uploader: true
          }
        },
        review: {
          include: {
            reviewer: true
          }
        }
      },
      orderBy: [{ activityDate: 'desc' }, { createdAt: 'desc' }]
    });
  },

  findById(milestoneId: string) {
    return prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: {
        project: true,
        creator: true,
        review: {
          include: {
            reviewer: true
          }
        },
        evidenceItems: {
          include: {
            uploader: true
          }
        }
      }
    });
  },

  update(milestoneId: string, data: Prisma.MilestoneUpdateInput) {
    return prisma.milestone.update({
      where: { id: milestoneId },
      data,
      include: {
        creator: true,
        evidenceItems: {
          include: {
            uploader: true
          }
        },
        review: {
          include: {
            reviewer: true
          }
        }
      }
    });
  },

  async getProjectId(milestoneId: string) {
    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
      select: {
        projectId: true
      }
    });

    return milestone?.projectId ?? null;
  },

  listWithinRange(projectId: string, fromDate?: Date | null, toDate?: Date | null) {
    return prisma.milestone.findMany({
      where: {
        projectId,
        ...(fromDate || toDate
          ? {
              activityDate: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {})
              }
            }
          : {})
      },
      include: {
        creator: true,
        review: {
          include: {
            reviewer: true
          }
        },
        evidenceItems: {
          include: {
            uploader: true
          }
        }
      },
      orderBy: [{ activityDate: 'desc' }, { createdAt: 'desc' }]
    });
  }
};
