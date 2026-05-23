import { AppError } from './appError';

type EvidenceTypeInput = 'photo' | 'video' | 'document' | 'receipt' | 'other';

const imageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const documentMimeTypes = new Set(['application/pdf']);
const videoMimeTypes = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

export const allowedUploadMimeTypes = new Set([...imageMimeTypes, ...documentMimeTypes, ...videoMimeTypes]);

const allowedMimeTypesByEvidenceType: Record<EvidenceTypeInput, Set<string>> = {
  photo: imageMimeTypes,
  video: videoMimeTypes,
  document: documentMimeTypes,
  receipt: new Set([...imageMimeTypes, ...documentMimeTypes]),
  other: new Set([...imageMimeTypes, ...documentMimeTypes, ...videoMimeTypes])
};

const hasSignature = (buffer: Buffer, signature: number[], offset = 0) => {
  if (buffer.length < offset + signature.length) {
    return false;
  }

  return signature.every((byte, index) => buffer[offset + index] === byte);
};

const includesAscii = (buffer: Buffer, value: string, offset: number) => {
  if (buffer.length < offset + value.length) {
    return false;
  }

  return buffer.subarray(offset, offset + value.length).toString('ascii') === value;
};

const detectMimeTypeFromBuffer = (buffer: Buffer): string | null => {
  if (hasSignature(buffer, [0xff, 0xd8, 0xff])) {
    return 'image/jpeg';
  }

  if (hasSignature(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }

  if (includesAscii(buffer, 'GIF87a', 0) || includesAscii(buffer, 'GIF89a', 0)) {
    return 'image/gif';
  }

  if (includesAscii(buffer, 'RIFF', 0) && includesAscii(buffer, 'WEBP', 8)) {
    return 'image/webp';
  }

  if (includesAscii(buffer, '%PDF-', 0)) {
    return 'application/pdf';
  }

  if (includesAscii(buffer, 'ftyp', 4)) {
    const brand = buffer.subarray(8, 12).toString('ascii');
    if (brand === 'qt  ') {
      return 'video/quicktime';
    }

    return 'video/mp4';
  }

  if (hasSignature(buffer, [0x1a, 0x45, 0xdf, 0xa3])) {
    return 'video/webm';
  }

  return null;
};

export const assertUploadedFileAllowed = (
  file: Pick<Express.Multer.File, 'mimetype' | 'buffer' | 'originalname'>,
  evidenceType: EvidenceTypeInput
) => {
  const allowedMimeTypes = allowedMimeTypesByEvidenceType[evidenceType];

  if (!allowedMimeTypes?.has(file.mimetype)) {
    throw new AppError(
      400,
      `Unsupported file type "${file.mimetype}" for evidence type "${evidenceType}"`,
      'UNSUPPORTED_FILE_TYPE'
    );
  }

  const detectedMimeType = detectMimeTypeFromBuffer(file.buffer);
  if (!detectedMimeType || !allowedMimeTypes.has(detectedMimeType) || detectedMimeType !== file.mimetype) {
    throw new AppError(
      400,
      `File content does not match the declared MIME type for "${file.originalname}"`,
      'INVALID_FILE_CONTENT'
    );
  }
};
