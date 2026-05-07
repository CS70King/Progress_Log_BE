import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';

export const snapshotRepository = {
  create(data: Prisma.SnapshotCreateInput) {
    return prisma.snapshot.create({
      data
    });
  },

  async listByProject(projectId: string) {
    const snapshots = await prisma.snapshot.findMany({
      where: { projectId },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Add milestone count from JSON array
    return snapshots.map(snapshot => ({
      ...snapshot,
      _count: {
        milestones: Array.isArray(snapshot.milestoneIds) ? snapshot.milestoneIds.length : 0
      }
    }));
  },

  async findById(snapshotId: string) {
    const snapshot = await prisma.snapshot.findUnique({
      where: { id: snapshotId }
    });

    if (!snapshot) return null;

    // Add milestone count from JSON array
    return {
      ...snapshot,
      _count: {
        milestones: Array.isArray(snapshot.milestoneIds) ? snapshot.milestoneIds.length : 0
      }
    };
  },

  async getProjectId(snapshotId: string) {
    const snapshot = await prisma.snapshot.findUnique({
      where: { id: snapshotId },
      select: {
        projectId: true
      }
    });

    return snapshot?.projectId ?? null;
  }
};
