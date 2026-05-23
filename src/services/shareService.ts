import { ShareResourceType } from '@prisma/client';
import { env } from '../config/env';
import { presentShareLink } from '../models/presenters';
import { shareLinkRepository } from '../repositories/shareLinkRepository';
import { projectRepository } from '../repositories/projectRepository';
import { AppError } from '../utils/appError';
import { logger } from '../utils/logger';
import { generateShareToken } from '../utils/token';
import { accessService } from './accessService';
import { dossierService } from './dossierService';

const buildExpiryDate = (hours: number) => {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
};

const assertLinkMatchesResource = (
  shareLink: Awaited<ReturnType<typeof shareLinkRepository.findById>>,
  resourceType: ShareResourceType,
  resourceId: string
) => {
  if (!shareLink || shareLink.resourceType !== resourceType || shareLink.resourceId !== resourceId) {
    throw new AppError(404, 'Share link not found', 'NOT_FOUND');
  }

  return shareLink;
};

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
    const createdShareLink = await shareLinkRepository.create({
      token,
      resourceType: ShareResourceType.PROJECT,
      resourceId: projectId,
      expiresAt: buildExpiryDate(env.PROJECT_SHARE_LINK_TTL_HOURS),
      creator: {
        connect: {
          id: userId
        }
      }
    });

    logger.info('share.project_create.service.created', {
      shareLinkId: createdShareLink.id,
      projectId,
      userId,
      tokenPrefix: token.slice(0, 8),
      expiresAt: createdShareLink.expiresAt?.toISOString() ?? null
    });
    return presentShareLink(createdShareLink);
  },

  async createSnapshotShareLink(snapshotId: string, userId: string) {
    logger.info('share.snapshot_create.service.start', {
      snapshotId,
      userId
    });
    const snapshot = await accessService.assertSnapshotOwner(snapshotId, userId);
    const token = generateShareToken();
    const createdShareLink = await shareLinkRepository.create({
      token,
      resourceType: ShareResourceType.SNAPSHOT,
      resourceId: snapshot.id,
      expiresAt: buildExpiryDate(env.SNAPSHOT_SHARE_LINK_TTL_HOURS),
      creator: {
        connect: {
          id: userId
        }
      }
    });

    logger.info('share.snapshot_create.service.created', {
      shareLinkId: createdShareLink.id,
      snapshotId,
      projectId: snapshot.projectId,
      userId,
      tokenPrefix: token.slice(0, 8),
      expiresAt: createdShareLink.expiresAt?.toISOString() ?? null
    });
    return presentShareLink(createdShareLink);
  },

  async revokeProjectShareLink(projectId: string, shareLinkId: string, userId: string) {
    logger.info('share.project_revoke.service.start', {
      projectId,
      shareLinkId,
      userId
    });
    await accessService.assertProjectOwner(projectId, userId);

    const shareLink = assertLinkMatchesResource(
      await shareLinkRepository.findById(shareLinkId),
      ShareResourceType.PROJECT,
      projectId
    );

    if (shareLink.revokedAt) {
      return presentShareLink(shareLink);
    }

    const revokedShareLink = await shareLinkRepository.revoke(shareLinkId, new Date());
    logger.info('share.project_revoke.service.completed', {
      projectId,
      shareLinkId,
      userId
    });
    return presentShareLink(revokedShareLink);
  },

  async revokeSnapshotShareLink(snapshotId: string, shareLinkId: string, userId: string) {
    logger.info('share.snapshot_revoke.service.start', {
      snapshotId,
      shareLinkId,
      userId
    });
    await accessService.assertSnapshotOwner(snapshotId, userId);

    const shareLink = assertLinkMatchesResource(
      await shareLinkRepository.findById(shareLinkId),
      ShareResourceType.SNAPSHOT,
      snapshotId
    );

    if (shareLink.revokedAt) {
      return presentShareLink(shareLink);
    }

    const revokedShareLink = await shareLinkRepository.revoke(shareLinkId, new Date());
    logger.info('share.snapshot_revoke.service.completed', {
      snapshotId,
      shareLinkId,
      userId
    });
    return presentShareLink(revokedShareLink);
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
