import crypto from 'crypto';
import { MilestoneStatus, ProjectState } from '@prisma/client';
import { env } from '../config/env';
import { presentEvidenceItem } from '../models/presenters';
import { evidenceRepository } from '../repositories/evidenceRepository';
import { prisma } from '../db/prisma';
import { storage } from '../storage';
import { AppError } from '../utils/appError';
import { toEvidenceType } from '../utils/enums';
import { assertUploadedFileAllowed } from '../utils/fileValidation';
import { logger } from '../utils/logger';
import { sanitizeFilename } from '../utils/strings';
import { cacheInvalidation } from '../helpers/cache/cacheInvalidation';
import { accessService } from './accessService';
import { fileScanService } from './fileScanService';
import { ImageService } from './imageService';

const mutableEvidenceStatuses: MilestoneStatus[] = [MilestoneStatus.DRAFT, MilestoneStatus.NEEDS_REVISION];

const ensureEvidenceMutable = (status: MilestoneStatus) => {
  if (!mutableEvidenceStatuses.includes(status)) {
    logger.warn('evidence.mutable_check.denied', {
      status
    });
    throw new AppError(
      409,
      'Evidence can only be modified when the milestone is draft or needs_revision',
      'CONFLICT'
    );
  }
};

const ensureProjectActive = (projectState: ProjectState) => {
  if (projectState !== ProjectState.ACTIVE) {
    logger.warn('evidence.project_state.denied', {
      projectState
    });
    throw new AppError(409, 'Evidence cannot be changed for completed or abandoned projects', 'CONFLICT');
  }
};

const formatUnknownError = (error: unknown) => (error instanceof Error ? error.message : 'Unknown error');

const deleteStoredEvidenceFileQuietly = async (
  filePath: string,
  context: {
    evidenceId: string;
    cleanupTarget: 'original' | 'thumbnail';
  }
) => {
  try {
    await storage.deleteEvidenceFile(env.SUPABASE_STORAGE_BUCKET, filePath);
  } catch (error) {
    logger.warn('evidence.cleanup.storage_delete_failed', {
      ...context,
      filePath,
      error: formatUnknownError(error)
    });
  }
};

const deleteEvidenceRecordQuietly = async (evidenceId: string) => {
  try {
    await evidenceRepository.delete(evidenceId);
  } catch (error) {
    logger.warn('evidence.cleanup.record_delete_failed', {
      evidenceId,
      error: formatUnknownError(error)
    });
  }
};

export const evidenceService = {
  async uploadEvidence(
    milestoneId: string,
    userId: string,
    input: {
      evidence_type: 'photo' | 'video' | 'document';
    },
    files: Express.Multer.File[]
  ) {
    logger.info('evidence.upload.service.start', {
      milestoneId,
      userId,
      fileCount: files.length,
      evidenceType: input.evidence_type
    });

    if (!files.length) {
      logger.warn('evidence.upload.service.no_files', {
        milestoneId,
        userId
      });
      throw new AppError(400, 'At least one file is required', 'VALIDATION_ERROR');
    }

    const milestone = await accessService.assertMilestoneOwner(milestoneId, userId);
    ensureProjectActive(milestone.project.state);
    ensureEvidenceMutable(milestone.status);

    const MAX_EVIDENCE_PER_MILESTONE = 20;
    const existingCount = await prisma.evidenceItem.count({ where: { milestoneId } });
    if (existingCount + files.length > MAX_EVIDENCE_PER_MILESTONE) {
      logger.warn('evidence.upload.service.too_many_files', {
        milestoneId,
        userId,
        existingCount,
        attemptedUploadCount: files.length,
        maxAllowed: MAX_EVIDENCE_PER_MILESTONE
      });
      throw new AppError(
        400,
        `A milestone can have at most ${MAX_EVIDENCE_PER_MILESTONE} evidence files`,
        'VALIDATION_ERROR'
      );
    }

    const items = [];
    let projectChanged = false;

    try {
      for (const file of files) {
        assertUploadedFileAllowed(file, input.evidence_type);
        await fileScanService.assertFileIsClean(file, input.evidence_type);

        const id = crypto.randomUUID();
        const filePath = `projects/${milestone.projectId}/milestones/${milestone.id}/${id}-${sanitizeFilename(
          file.originalname
        )}`;

        let width: number | undefined;
        let height: number | undefined;
        let thumbnailPath: string | undefined;
        let thumbnailSize: bigint | undefined;
        let thumbnailWidth: number | undefined;
        let thumbnailHeight: number | undefined;
        let thumbnailBuffer: Buffer | undefined;
        let record: Awaited<ReturnType<typeof evidenceRepository.create>> | null = null;

        if (file.mimetype.startsWith('image/')) {
          try {
            const isImage = await ImageService.isImage(file.buffer);
            if (isImage) {
              const metadata = await ImageService.extractMetadata(file.buffer);
              width = metadata.width;
              height = metadata.height;

              const thumbnail = await ImageService.generateThumbnail(file.buffer);
              thumbnailPath = ImageService.getThumbnailPath(filePath);
              thumbnailSize = BigInt(thumbnail.size);
              thumbnailWidth = thumbnail.width;
              thumbnailHeight = thumbnail.height;
              thumbnailBuffer = thumbnail.buffer;

              logger.info('evidence.upload.service.thumbnail_generated', {
                evidenceId: id,
                thumbnailPath,
                thumbnailSize: thumbnail.size
              });
            }
          } catch (error) {
            logger.warn('evidence.upload.service.thumbnail_generation_failed', {
              evidenceId: id,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }

        try {
          logger.info('evidence.upload.service.storage_upload_start', {
            evidenceId: id,
            bucket: env.SUPABASE_STORAGE_BUCKET,
            filePath
          });

          await storage.uploadEvidenceFile(env.SUPABASE_STORAGE_BUCKET, filePath, file.buffer, file.mimetype);

          if (thumbnailPath && thumbnailBuffer) {
            await storage.uploadEvidenceFile(
              env.SUPABASE_STORAGE_BUCKET,
              thumbnailPath,
              thumbnailBuffer,
              'image/jpeg'
            );
          }

          record = await evidenceRepository.create({
            id,
            project: {
              connect: {
                id: milestone.projectId
              }
            },
            milestone: {
              connect: {
                id: milestone.id
              }
            },
            uploader: {
              connect: {
                id: userId
              }
            },
            evidenceType: toEvidenceType(input.evidence_type),
            filePath,
            originalFilename: file.originalname,
            contentType: file.mimetype,
            sizeBytes: BigInt(file.size),
            ...(width !== undefined ? { width } : {}),
            ...(height !== undefined ? { height } : {}),
            ...(thumbnailPath !== undefined ? { thumbnailPath } : {}),
            ...(thumbnailSize !== undefined ? { thumbnailSize } : {}),
            ...(thumbnailWidth !== undefined ? { thumbnailWidth } : {}),
            ...(thumbnailHeight !== undefined ? { thumbnailHeight } : {})
          });

          logger.info('evidence.upload.service.record_created', {
            evidenceId: record.id,
            milestoneId: milestone.id,
            projectId: milestone.projectId,
            originalFilename: file.originalname,
            contentType: file.mimetype,
            sizeBytes: file.size
          });
        } catch (error) {
          logger.error('evidence.upload.service.storage_upload_failed_rolling_back', {
            evidenceId: record?.id ?? id,
            filePath,
            error: formatUnknownError(error)
          });

          if (record) {
            await deleteEvidenceRecordQuietly(record.id);
          }

          if (thumbnailPath) {
            await deleteStoredEvidenceFileQuietly(thumbnailPath, {
              evidenceId: record?.id ?? id,
              cleanupTarget: 'thumbnail'
            });
          }

          await deleteStoredEvidenceFileQuietly(filePath, {
            evidenceId: record?.id ?? id,
            cleanupTarget: 'original'
          });
          throw error;
        }

        if (!record) {
          throw new AppError(500, 'Evidence record was not created after upload', 'EVIDENCE_CREATE_FAILED');
        }

        logger.info('evidence.upload.service.storage_uploaded', {
          evidenceId: record.id,
          filePath
        });

        let signedUrl: string | null = null;
        let signedUrlExpiresAt: string | null = null;

        try {
          const signed = await storage.signEvidenceUrl(
            env.SUPABASE_STORAGE_BUCKET,
            filePath,
            env.SIGNED_URL_TTL_SECONDS
          );
          signedUrl = signed.url;
          signedUrlExpiresAt = signed.expiresAt;
        } catch (error) {
          logger.warn('evidence.upload.service.sign_failed', {
            evidenceId: record.id,
            milestoneId: milestone.id,
            projectId: milestone.projectId,
            filePath,
            error: formatUnknownError(error)
          });
        }

        items.push({
          ...presentEvidenceItem(record),
          signed_url: signedUrl,
          signed_url_expires_at: signedUrlExpiresAt
        });
        projectChanged = true;
      }
    } finally {
      if (projectChanged) {
        await cacheInvalidation.invalidateProjectDossier(milestone.projectId);
      }
    }

    logger.info('evidence.upload.service.completed', {
      milestoneId,
      count: items.length
    });

    return {
      project_id: milestone.projectId,
      milestone_id: milestone.id,
      uploader: items[0]?.uploader ?? null,
      evidence_type: input.evidence_type,
      items: items.map((item) => {
        const { project_id, milestone_id, uploader, evidence_type, ...rest } = item;
        return rest;
      })
    };
  },

  async deleteEvidence(evidenceId: string, userId: string) {
    logger.info('evidence.delete.service.start', {
      evidenceId,
      userId
    });
    const evidence = await evidenceRepository.findById(evidenceId);
    if (!evidence) {
      logger.warn('evidence.delete.service.not_found', {
        evidenceId
      });
      throw new AppError(404, 'Evidence not found', 'NOT_FOUND');
    }

    const milestone = await accessService.assertMilestoneOwner(evidence.milestoneId, userId);
    ensureProjectActive(milestone.project.state);
    ensureEvidenceMutable(milestone.status);

    await storage.deleteEvidenceFile(env.SUPABASE_STORAGE_BUCKET, evidence.filePath);
    if (evidence.thumbnailPath) {
      await deleteStoredEvidenceFileQuietly(evidence.thumbnailPath, {
        evidenceId,
        cleanupTarget: 'thumbnail'
      });
    }
    await evidenceRepository.delete(evidenceId);
    await cacheInvalidation.invalidateProjectDossier(evidence.projectId);

    logger.info('evidence.delete.service.deleted', {
      evidenceId,
      milestoneId: evidence.milestoneId,
      projectId: evidence.projectId,
      filePath: evidence.filePath
    });
    return presentEvidenceItem(evidence);
  }
};
