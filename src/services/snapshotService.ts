import crypto from 'crypto';
import { presentSnapshot } from '../models/presenters';
import { milestoneRepository } from '../repositories/milestoneRepository';
import { projectRepository } from '../repositories/projectRepository';
import { snapshotRepository } from '../repositories/snapshotRepository';
import { AppError } from '../utils/appError';
import { logger } from '../utils/logger';
import { accessService } from './accessService';
import { dossierService } from './dossierService';

export const snapshotService = {
  async createSnapshot(
    projectId: string,
    userId: string,
    input: {
      title: string;
    }
  ) {
    logger.info('snapshot.create.service.start', {
      projectId,
      userId,
      title: input.title
    });
    await accessService.assertProjectOwner(projectId, userId);

    const project = await projectRepository.findById(projectId);
    if (!project) {
      logger.warn('snapshot.create.service.project_not_found', {
        projectId
      });
      throw new AppError(404, 'Project not found', 'NOT_FOUND');
    }

    // Get ALL current milestones (no time filtering)
    const milestones = await milestoneRepository.listByProject(projectId);
    const snapshotId = crypto.randomUUID();
    const createdAt = new Date();

    logger.info('snapshot.create.service.milestones_selected', {
      projectId,
      snapshotId,
      milestoneCount: milestones.length
    });

    const immutablePayload = await dossierService.buildSnapshotImmutablePayload(
      project,
      {
        id: snapshotId,
        title: input.title,
        fromDate: null,
        toDate: null,
        createdAt
      },
      milestones
    );

    const snapshot = await snapshotRepository.create({
      id: snapshotId,
      title: input.title,
      fromDate: null,
      toDate: null,
      milestoneIds: milestones.map((milestone) => milestone.id),
      immutablePayload,
      project: {
        connect: {
          id: projectId
        }
      },
      creator: {
        connect: {
          id: userId
        }
      }
    });

    logger.info('snapshot.create.service.created', {
      snapshotId: snapshot.id,
      projectId,
      milestoneCount: milestones.length
    });
    return presentSnapshot(snapshot);
  },

  async listSnapshots(projectId: string, userId: string) {
    logger.info('snapshot.list.service.start', {
      projectId,
      userId
    });
    await accessService.assertProjectAccess(projectId, userId);
    const snapshots = await snapshotRepository.listByProject(projectId);
    logger.info('snapshot.list.service.found', {
      projectId,
      count: snapshots.length
    });
    return snapshots.map((snapshot) => presentSnapshot(snapshot));
  },

  async getSnapshot(snapshotId: string, userId: string) {
    logger.info('snapshot.get.service.start', {
      snapshotId,
      userId
    });
    const snapshot = await accessService.assertSnapshotAccess(snapshotId, userId);
    return presentSnapshot(snapshot);
  }
};
