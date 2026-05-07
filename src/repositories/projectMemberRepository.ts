import { ProjectMemberRole } from '@prisma/client';
import { prisma } from '../db/prisma';

export const projectMemberRepository = {
  create(projectId: string, userId: string, role: ProjectMemberRole) {
    return prisma.projectMember.create({
      data: {
        projectId,
        userId,
        role
      }
    });
  },

  createMany(data: { projectId: string; userId: string; role: ProjectMemberRole }[]) {
    return prisma.projectMember.createMany({ data });
  },

  findMember(projectId: string, userId: string) {
    return prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId
        }
      }
    });
  },

  listByProject(projectId: string) {
    return prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: true
      }
    });
  }
};
