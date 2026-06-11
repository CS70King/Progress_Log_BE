import { RequestHandler } from 'express';
import multer from 'multer';
import { env } from '../config/env';
import { AppError } from '../utils/appError';
import { canPassInitialUploadMimeGate } from '../utils/fileValidation';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: env.UPLOAD_MAX_FILES,
    fileSize: Math.floor(env.UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024),
    fields: 10
  },
  fileFilter: (_req, file, callback) => {
    if (!canPassInitialUploadMimeGate(file)) {
      callback(new AppError(400, `Unsupported file type "${file.mimetype}"`, 'UNSUPPORTED_FILE_TYPE'));
      return;
    }

    callback(null, true);
  }
});

export const uploadEvidenceFiles = (fieldName = 'files'): RequestHandler => {
  return (req, res, next) => {
    upload.array(fieldName)(req, res, (error) => {
      if (!error) {
        return next();
      }

      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return next(new AppError(413, 'File size exceeds upload limit', 'FILE_TOO_LARGE'));
        }

        return next(new AppError(400, error.message, 'UPLOAD_ERROR'));
      }

      return next(error);
    });
  };
};
