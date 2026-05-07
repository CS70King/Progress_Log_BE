import { ShareResourceType } from '@prisma/client';
import { shareLinkRepository } from '../repositories/shareLinkRepository';
import { projectRepository } from '../repositories/projectRepository';
import { AppError } from '../utils/appError';
import { logger } from '../utils/logger';
import { generateShareToken } from '../utils/token';
import { accessService } from './accessService';
import { dossierService } from './dossierService';

const getActiveShareLink = async (token: string) => {
  logger.info('share.lookup.service.start', {
    tokenPrefix: token.slice(0, 8)
  });
  const shareLink = await shareLinkRepository.findByToken(token);
  if (!shareLink) {
    logger.warn('share.lookup.service.not_found', {
      tokenPrefix: token.slice(0, 8)
    });
    throw new AppError(404, 'Share link not found', 'NOT_FOUND');
  }

  if (shareLink.revokedAt) {
    logger.warn('share.lookup.service.revoked', {
      shareLinkId: shareLink.id,
      tokenPrefix: token.slice(0, 8)
    });
    throw new AppError(410, 'Share link has been revoked', 'GONE');
  }

  if (shareLink.expiresAt && shareLink.expiresAt.getTime() < Date.now()) {
    logger.warn('share.lookup.service.expired', {
      shareLinkId: shareLink.id,
      tokenPrefix: token.slice(0, 8)
    });
    throw new AppError(410, 'Share link has expired', 'GONE');
  }

  logger.info('share.lookup.service.active', {
    shareLinkId: shareLink.id,
    resourceType: shareLink.resourceType,
    resourceId: shareLink.resourceId
  });
  return shareLink;
};

export const shareService = {
  async createProjectShareLink(projectId: string, userId: string) {
    logger.info('share.project_create.service.start', {
      projectId,
      userId
    });
    await accessService.assertProjectOwner(projectId, userId);

    const project = await projectRepository.findByIdBasic(projectId);
    if (!project) {
      throw new AppError(404, 'Project not found', 'NOT_FOUND');
    }
    if (project.state !== 'COMPLETED') {
      logger.warn('share.project_create.service.project_not_completed', {
        projectId,
        state: project.state
      });
      throw new AppError(409, 'Only completed projects can be shared', 'CONFLICT');
    }

    const token = generateShareToken();

    await shareLinkRepository.create({
      token,
      resourceType: ShareResourceType.PROJECT,
      resourceId: projectId,
      creator: {
        connect: {
          id: userId
        }
      }
    });

    logger.info('share.project_create.service.created', {
      projectId,
      userId,
      tokenPrefix: token.slice(0, 8)
    });
    return {
      token,
      url_path: `/share/${token}/dossier`
    };
  },

  async createSnapshotShareLink(snapshotId: string, userId: string) {
    logger.info('share.snapshot_create.service.start', {
      snapshotId,
      userId
    });
    const snapshot = await accessService.assertSnapshotOwner(snapshotId, userId);
    const token = generateShareToken();

    await shareLinkRepository.create({
      token,
      resourceType: ShareResourceType.SNAPSHOT,
      resourceId: snapshot.id,
      creator: {
        connect: {
          id: userId
        }
      }
    });

    logger.info('share.snapshot_create.service.created', {
      snapshotId,
      projectId: snapshot.projectId,
      userId,
      tokenPrefix: token.slice(0, 8)
    });
    return {
      token,
      url_path: `/share/${token}/dossier`
    };
  },

  async shareDossier(token: string) {
    const shareLink = await getActiveShareLink(token);

    if (shareLink.resourceType === ShareResourceType.PROJECT) {
      logger.info('share.dossier.service.project', {
        shareLinkId: shareLink.id,
        projectId: shareLink.resourceId
      });
      return dossierService.projectDossierForShare(shareLink.resourceId);
    }

    logger.info('share.dossier.service.snapshot', {
      shareLinkId: shareLink.id,
      snapshotId: shareLink.resourceId
    });
    return dossierService.snapshotDossierForShare(shareLink.resourceId);
  }
};
