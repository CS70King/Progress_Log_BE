import { EvidenceItem, User } from '@prisma/client';
import { env } from '../config/env';
import { presentEvidenceItem } from '../models/presenters';
import { storage } from '../storage';
import { logger } from './logger';

type EvidenceWithUploader = EvidenceItem & { uploader?: User | null };

type SignFailureOptions = {
  event: string;
  context: Record<string, unknown>;
};

const signFilePath = async (filePath: string | null | undefined, options: SignFailureOptions) => {
  if (!filePath) {
    return {
      url: null,
      expiresAt: null
    };
  }

  try {
    const signed = await storage.signEvidenceUrl(env.SUPABASE_STORAGE_BUCKET, filePath, env.SIGNED_URL_TTL_SECONDS);
    return {
      url: signed.url,
      expiresAt: signed.expiresAt
    };
  } catch (_error) {
    logger.warn(options.event, {
      ...options.context,
      filePath
    });
    return {
      url: null,
      expiresAt: null
    };
  }
};

export const presentEvidenceItemWithSignedUrls = async (
  item: EvidenceWithUploader,
  options: {
    signErrorEvent: string;
    thumbnailSignErrorEvent: string;
    context: Record<string, unknown>;
  }
) => {
  const presented = presentEvidenceItem(item);

  const [signed, thumbnailSigned] = await Promise.all([
    signFilePath(presented.file_path, {
      event: options.signErrorEvent,
      context: {
        ...options.context,
        evidenceId: presented.id
      }
    }),
    signFilePath(presented.thumbnail_path, {
      event: options.thumbnailSignErrorEvent,
      context: {
        ...options.context,
        evidenceId: presented.id
      }
    })
  ]);

  return {
    ...presented,
    signed_url: signed.url,
    signed_url_expires_at: signed.expiresAt,
    thumbnail_signed_url: thumbnailSigned.url,
    thumbnail_signed_url_expires_at: thumbnailSigned.expiresAt
  };
};
