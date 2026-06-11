import { AppError } from './appError';
import JSZip from 'jszip';
const WordExtractor = require('word-extractor');

type EvidenceTypeInput = 'photo' | 'video' | 'document';

const imageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const documentMimeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/plain',
  'text/csv'
]);
const videoMimeTypes = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

export const allowedUploadMimeTypes = new Set([...imageMimeTypes, ...documentMimeTypes, ...videoMimeTypes]);

const allowedMimeTypesByEvidenceType: Record<EvidenceTypeInput, Set<string>> = {
  photo: imageMimeTypes,
  video: videoMimeTypes,
  document: documentMimeTypes
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

const hasMostlyPrintableText = (buffer: Buffer) => {
  if (buffer.length === 0 || buffer.includes(0x00)) {
    return false;
  }

  let printableCharacters = 0;
  for (const byte of buffer) {
    if (
      byte === 0x09 ||
      byte === 0x0a ||
      byte === 0x0d ||
      (byte >= 0x20 && byte <= 0x7e)
    ) {
      printableCharacters += 1;
    }
  }

  return printableCharacters / buffer.length >= 0.85;
};

const detectOfficeOpenXmlMimeType = async (buffer: Buffer): Promise<string | null> => {
  try {
    const archive = await JSZip.loadAsync(buffer);
    const filenames = Object.keys(archive.files);

    if (filenames.some((name) => name.startsWith('word/'))) {
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }

    if (filenames.some((name) => name.startsWith('xl/'))) {
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }

    return null;
  } catch {
    return null;
  }
};

const detectLegacyOfficeMimeType = async (buffer: Buffer): Promise<string> => {
  try {
    const extractor = new WordExtractor();
    const extracted = await extractor.extract(buffer);
    const body = typeof extracted?.getBody === 'function' ? extracted.getBody() : '';

    if (typeof body === 'string' && body.trim().length > 0) {
      return 'application/msword';
    }
  } catch {
    // Fall through to the legacy spreadsheet type below.
  }

  return 'application/vnd.ms-excel';
};

const detectMimeTypeFromBuffer = async (buffer: Buffer): Promise<string | null> => {
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

  if (hasSignature(buffer, [0x50, 0x4b, 0x03, 0x04])) {
    return detectOfficeOpenXmlMimeType(buffer);
  }

  if (hasSignature(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    return detectLegacyOfficeMimeType(buffer);
  }

  if (hasMostlyPrintableText(buffer)) {
    return 'text/plain';
  }

  return null;
};

export const assertUploadedFileAllowed = async (
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

  const detectedMimeType = await detectMimeTypeFromBuffer(file.buffer);
  const textLikeDocumentMimeTypes = new Set(['text/plain', 'text/csv']);

  const isAllowedDocumentAlias =
    evidenceType === 'document' &&
    ((file.mimetype === 'text/csv' && detectedMimeType === 'text/plain') ||
      (file.mimetype === 'application/vnd.ms-excel' &&
        (detectedMimeType === 'application/vnd.ms-excel' || detectedMimeType === 'text/plain')) ||
      (file.mimetype === 'application/msword' && detectedMimeType === 'application/msword') ||
      (textLikeDocumentMimeTypes.has(file.mimetype) && detectedMimeType === 'text/plain'));

  if (
    !detectedMimeType ||
    (!allowedMimeTypes.has(detectedMimeType) && !isAllowedDocumentAlias) ||
    (detectedMimeType !== file.mimetype && !isAllowedDocumentAlias)
  ) {
    throw new AppError(
      400,
      `File content does not match the declared MIME type for "${file.originalname}"`,
      'INVALID_FILE_CONTENT'
    );
  }
};
