import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';

export const projectRepository = {
  create(data: Prisma.ProjectCreateInput) {
    return prisma.project.create({
      data,
      include: {
        owner: true,
        members: {
          include: {
            user: true
          }
        }
      }
    });
  },

  findById(projectId: string) {
    return prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: true,
        members: {
          include: {
            user: true
          }
        }
      }
    });
  },

  findByIdBasic(projectId: string) {
    return prisma.project.findUnique({ where: { id: projectId } });
  },

  findByDedupeKey(dedupeKey: string) {
    return prisma.project.findUnique({ where: { dedupeKey } });
  },

  findAccessibleProjects(userId: string) {
    return prisma.project.findMany({
      where: {
        OR: [
          { ownerId: userId },
          {
            members: {
              some: {
                userId
              }
            }
          }
        ]
      },
      include: {
        owner: true,
        members: {
          include: {
            user: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  },

  async isOwner(projectId: string, userId: string) {
    const match = await prisma.project.findFirst({
      where: {
        id: projectId,
        ownerId: userId
      },
      select: {
        id: true
      }
    });

    return Boolean(match);
  },

  updateDedupeKey(projectId: string, dedupeKey: string) {
    return prisma.project.update({
      where: { id: projectId },
      data: { dedupeKey }
    });
  },

  updateState(projectId: string, state: Prisma.ProjectUpdateInput['state']) {
    return prisma.project.update({
      where: { id: projectId },
      data: { state },
      include: {
        owner: true,
        members: {
          include: {
            user: true
          }
        }
      }
    });
  }
};
