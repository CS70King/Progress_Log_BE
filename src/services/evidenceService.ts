import crypto from 'crypto';
import { MilestoneStatus } from '@prisma/client';
import { env } from '../config/env';
import { presentEvidenceItem } from '../models/presenters';
import { evidenceRepository } from '../repositories/evidenceRepository';
import { prisma } from '../db/prisma';
import { storage } from '../storage';
import { AppError } from '../utils/appError';
import { toEvidenceType } from '../utils/enums';
import { logger } from '../utils/logger';
import { sanitizeFilename } from '../utils/strings';
import { accessService } from './accessService';

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

export const evidenceService = {
  async uploadEvidence(
    milestoneId: string,
    userId: string,
    input: {
      evidence_type: 'photo' | 'video' | 'document' | 'receipt' | 'other';
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

    for (const file of files) {
      const id = crypto.randomUUID();
      const filePath = `projects/${milestone.projectId}/milestones/${milestone.id}/${id}-${sanitizeFilename(
        file.originalname
      )}`;

      const record = await evidenceRepository.create({
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
        sizeBytes: BigInt(file.size)
      });

      logger.info('evidence.upload.service.record_created', {
        evidenceId: record.id,
        milestoneId: milestone.id,
        projectId: milestone.projectId,
        originalFilename: file.originalname,
        contentType: file.mimetype,
        sizeBytes: file.size
      });

      try {
        logger.info('evidence.upload.service.storage_upload_start', {
          evidenceId: record.id,
          bucket: env.SUPABASE_STORAGE_BUCKET,
          filePath
        });
        await storage.uploadEvidenceFile(env.SUPABASE_STORAGE_BUCKET, filePath, file.buffer, file.mimetype);
      } catch (error) {
        logger.error('evidence.upload.service.storage_upload_failed_rolling_back', {
          evidenceId: record.id,
          filePath
        });
        await evidenceRepository.delete(record.id);
        throw error;
      }

      logger.info('evidence.upload.service.storage_uploaded', {
        evidenceId: record.id,
        filePath
      });

      const signed = await storage.signEvidenceUrl(
        env.SUPABASE_STORAGE_BUCKET,
        filePath,
        env.SIGNED_URL_TTL_SECONDS
      );

      items.push({
        ...presentEvidenceItem(record),
        signed_url: signed.url,
        signed_url_expires_at: signed.expiresAt
      });
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
    ensureEvidenceMutable(milestone.status);

    await storage.deleteEvidenceFile(env.SUPABASE_STORAGE_BUCKET, evidence.filePath);
    await evidenceRepository.delete(evidenceId);

    logger.info('evidence.delete.service.deleted', {
      evidenceId,
      milestoneId: evidence.milestoneId,
      projectId: evidence.projectId,
      filePath: evidence.filePath
    });
    return presentEvidenceItem(evidence);
  }
};
