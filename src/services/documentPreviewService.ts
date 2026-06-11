import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import sharp from 'sharp';
import * as XLSX from 'xlsx';
import { ImageService, ThumbnailResult } from './imageService';
const WordExtractor = require('word-extractor');

type DocumentPreviewKind = 'pdf' | 'document' | 'spreadsheet' | 'text';

const THUMBNAIL_SIZE = 300;
const PREVIEW_BACKGROUND = '#e8ecef';
const PAGE_BACKGROUND = '#ffffff';
const PAGE_BORDER = '#d4d8dd';
const HEADER_BACKGROUND = '#1f2937';
const HEADER_TEXT = '#f9fafb';
const BODY_TEXT = '#24313f';
const SUBTLE_TEXT = '#52606d';

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const normalizeWhitespace = (value: string) => value.replace(/\r/g, '').replace(/\t/g, '  ').trim();

const truncate = (value: string, maxLength: number) =>
  value.length > maxLength ? `${value.slice(0, Math.max(0, maxLength - 1))}\u2026` : value;

const buildTextLines = (value: string, maxLines: number, maxCharsPerLine: number) => {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return ['No preview text available'];
  }

  const rawLines = normalized.split('\n').flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return [''];
    }

    const chunks: string[] = [];
    let remaining = trimmed;

    while (remaining.length > maxCharsPerLine) {
      let splitIndex = remaining.lastIndexOf(' ', maxCharsPerLine);
      if (splitIndex <= 0) {
        splitIndex = maxCharsPerLine;
      }

      chunks.push(remaining.slice(0, splitIndex).trim());
      remaining = remaining.slice(splitIndex).trim();
    }

    if (remaining) {
      chunks.push(remaining);
    }

    return chunks;
  });

  return rawLines.filter((line, index) => line.length > 0 || index === 0).slice(0, maxLines);
};

const renderPreviewSvg = (options: {
  filename: string;
  label: string;
  kind: DocumentPreviewKind;
  lines: string[];
}) => {
  const isSpreadsheet = options.kind === 'spreadsheet';
  const pageX = isSpreadsheet ? 22 : 44;
  const pageY = isSpreadsheet ? 52 : 22;
  const pageWidth = isSpreadsheet ? 256 : 212;
  const pageHeight = isSpreadsheet ? 196 : 256;
  const lineHeight = isSpreadsheet ? 12 : 13;
  const bodyFontSize = isSpreadsheet ? 8.4 : 9.2;
  const bodyFontFamily = isSpreadsheet ? 'Courier New, monospace' : 'Arial, sans-serif';
  const headerLabel = truncate(options.label.toUpperCase(), 10);
  const filename = truncate(options.filename, 26);
  const lines = options.lines.length > 0 ? options.lines : ['No preview text available'];

  const lineMarkup = lines
    .map((line, index) => {
      const y = pageY + 54 + index * lineHeight;
      return `<text x="${pageX + 18}" y="${y}" font-family="${bodyFontFamily}" font-size="${bodyFontSize}" fill="${BODY_TEXT}">${escapeXml(
        truncate(line, isSpreadsheet ? 52 : 34)
      )}</text>`;
    })
    .join('');

  return `
    <svg width="${THUMBNAIL_SIZE}" height="${THUMBNAIL_SIZE}" viewBox="0 0 ${THUMBNAIL_SIZE} ${THUMBNAIL_SIZE}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${THUMBNAIL_SIZE}" height="${THUMBNAIL_SIZE}" rx="28" fill="${PREVIEW_BACKGROUND}" />
      <rect x="${pageX}" y="${pageY}" width="${pageWidth}" height="${pageHeight}" rx="14" fill="${PAGE_BACKGROUND}" stroke="${PAGE_BORDER}" stroke-width="2" />
      <rect x="${pageX}" y="${pageY}" width="${pageWidth}" height="34" rx="14" fill="${HEADER_BACKGROUND}" />
      <rect x="${pageX}" y="${pageY + 17}" width="${pageWidth}" height="17" fill="${HEADER_BACKGROUND}" />
      <text x="${pageX + 18}" y="${pageY + 22}" font-family="Arial, sans-serif" font-size="11" font-weight="700" fill="${HEADER_TEXT}">${escapeXml(
        headerLabel
      )}</text>
      <text x="${pageX + 18}" y="${pageY + 42}" font-family="Arial, sans-serif" font-size="8.4" fill="${SUBTLE_TEXT}">${escapeXml(
        filename
      )}</text>
      ${lineMarkup}
    </svg>
  `;
};

const renderThumbnail = async (svg: string): Promise<ThumbnailResult> => {
  const rendered = await sharp(Buffer.from(svg))
    .jpeg({
      quality: 86,
      progressive: true
    })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: rendered.data,
    width: rendered.info.width,
    height: rendered.info.height,
    size: rendered.info.size
  };
};

const renderPdfPreview = async (buffer: Buffer) => {
  const parser = new PDFParse({ data: buffer });

  try {
    const screenshot = await parser.getScreenshot({
      first: 1,
      imageBuffer: true,
      imageDataUrl: false,
      desiredWidth: 1200
    });
    const firstPage = screenshot.pages[0];
    if (!firstPage?.data) {
      throw new Error('PDF screenshot data was empty');
    }

    return Buffer.from(firstPage.data);
  } finally {
    await parser.destroy();
  }
};

const extractDocxText = async (buffer: Buffer) => {
  const result = await mammoth.extractRawText({ buffer });
  return result.value || '';
};

const extractDocText = async (buffer: Buffer) => {
  const extractor = new WordExtractor();
  const extracted = await extractor.extract(buffer);
  return extracted.getBody?.() || '';
};

const extractSpreadsheetLines = (buffer: Buffer) => {
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellText: true,
    cellDates: true
  });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return ['No spreadsheet rows available'];
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
    header: 1,
    blankrows: false,
    raw: false
  });

  const previewLines = rows.slice(0, 12).map((row) =>
    row
      .slice(0, 6)
      .map((cell) => (cell === null || cell === undefined ? '' : String(cell)))
      .join(' | ')
      .trim()
  );

  return previewLines.filter((line) => line.length > 0);
};

const extractPlainText = (buffer: Buffer) => buffer.toString('utf8');

export class DocumentPreviewService {
  static async generateThumbnail(
    documentBuffer: Buffer,
    options: {
      contentType: string;
      originalFilename: string;
    }
  ): Promise<ThumbnailResult> {
    switch (options.contentType) {
      case 'application/pdf': {
        const previewBuffer = await renderPdfPreview(documentBuffer);
        return ImageService.generateThumbnail(previewBuffer);
      }
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
        const lines = buildTextLines(await extractDocxText(documentBuffer), 14, 34);
        return renderThumbnail(
          renderPreviewSvg({
            filename: options.originalFilename,
            label: 'DOCX',
            kind: 'document',
            lines
          })
        );
      }
      case 'application/msword': {
        const lines = buildTextLines(await extractDocText(documentBuffer), 14, 34);
        return renderThumbnail(
          renderPreviewSvg({
            filename: options.originalFilename,
            label: 'DOC',
            kind: 'document',
            lines
          })
        );
      }
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      case 'application/vnd.ms-excel': {
        let lines: string[];
        try {
          lines = extractSpreadsheetLines(documentBuffer);
        } catch {
          lines = buildTextLines(extractPlainText(documentBuffer), 14, 34);
        }
        return renderThumbnail(
          renderPreviewSvg({
            filename: options.originalFilename,
            label: options.contentType === 'application/vnd.ms-excel' ? 'XLS' : 'XLSX',
            kind: 'spreadsheet',
            lines
          })
        );
      }
      case 'text/plain':
      case 'text/csv': {
        const lines = buildTextLines(extractPlainText(documentBuffer), 14, 34);
        return renderThumbnail(
          renderPreviewSvg({
            filename: options.originalFilename,
            label: options.contentType === 'text/csv' ? 'CSV' : 'TXT',
            kind: 'text',
            lines
          })
        );
      }
      default:
        throw new Error(`Unsupported document preview MIME type: ${options.contentType}`);
    }
  }
}
