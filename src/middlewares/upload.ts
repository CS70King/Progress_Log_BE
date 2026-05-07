import { RequestHandler } from 'express';
import multer from 'multer';
import { AppError } from '../utils/appError';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 20,
    fileSize: 50 * 1024 * 1024
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
