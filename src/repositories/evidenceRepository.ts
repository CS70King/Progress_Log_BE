import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';

export const evidenceRepository = {
  create(data: Prisma.EvidenceItemCreateInput) {
    return prisma.evidenceItem.create({
      data,
      include: {
        uploader: true
      }
    });
  },

  update(evidenceId: string, data: Prisma.EvidenceItemUpdateInput) {
    return prisma.evidenceItem.update({
      where: { id: evidenceId },
      data,
      include: {
        uploader: true
      }
    });
  },

  findById(evidenceId: string) {
    return prisma.evidenceItem.findUnique({
      where: { id: evidenceId },
      include: {
        milestone: true,
        uploader: true
      }
    });
  },

  delete(evidenceId: string) {
    return prisma.evidenceItem.delete({
      where: { id: evidenceId }
    });
  },

  async getProjectId(evidenceId: string) {
    const item = await prisma.evidenceItem.findUnique({
      where: { id: evidenceId },
      select: {
        projectId: true
      }
    });

    return item?.projectId ?? null;
  }
};
