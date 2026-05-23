import { env } from '../config/env';
import { AppError } from '../utils/appError';
import { logger } from '../utils/logger';

const buildScanHeaders = (file: Pick<Express.Multer.File, 'originalname' | 'mimetype' | 'size'>, evidenceType: string) => {
  const headers: Record<string, string> = {
    'Content-Type': file.mimetype,
    Accept: 'application/json',
    'X-File-Name': encodeURIComponent(file.originalname),
    'X-File-Size': String(file.size),
    'X-Evidence-Type': evidenceType
  };

  if (env.UPLOAD_SCAN_API_KEY) {
    headers['X-Scan-Api-Key'] = env.UPLOAD_SCAN_API_KEY;
  }

  return headers;
};

export const fileScanService = {
  async assertFileIsClean(
    file: Pick<Express.Multer.File, 'originalname' | 'mimetype' | 'size' | 'buffer'>,
    evidenceType: string
  ) {
    if (env.UPLOAD_SCAN_MODE === 'off') {
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.UPLOAD_SCAN_TIMEOUT_MS);

    try {
      logger.info('upload.scan.start', {
        filename: file.originalname,
        mimetype: file.mimetype,
        sizeBytes: file.size,
        evidenceType
      });

      const response = await fetch(env.UPLOAD_SCAN_URL!, {
        method: 'POST',
        headers: buildScanHeaders(file, evidenceType),
        body: file.buffer,
        signal: controller.signal
      });

      let payload: { clean?: boolean; message?: string; reason?: string } | null = null;
      try {
        payload = (await response.json()) as { clean?: boolean; message?: string; reason?: string };
      } catch {
        payload = null;
      }

      if (!response.ok) {
        logger.error('upload.scan.http_error', {
          statusCode: response.status,
          filename: file.originalname,
          message: payload?.message ?? payload?.reason ?? 'Scanner request failed'
        });
        throw new AppError(503, 'File scanning service is unavailable', 'FILE_SCAN_UNAVAILABLE');
      }

      if (payload?.clean !== true) {
        logger.warn('upload.scan.failed', {
          filename: file.originalname,
          reason: payload?.reason ?? payload?.message ?? 'Scanner rejected file'
        });
        throw new AppError(400, payload?.reason ?? payload?.message ?? 'Uploaded file failed security scan', 'FILE_SCAN_FAILED');
      }

      logger.info('upload.scan.clean', {
        filename: file.originalname,
        evidenceType
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.error('upload.scan.error', {
        filename: file.originalname,
        message: error instanceof Error ? error.message : 'Unknown scanner error'
      });
      throw new AppError(503, 'File scanning service is unavailable', 'FILE_SCAN_UNAVAILABLE');
    } finally {
      clearTimeout(timeout);
    }
  }
};
