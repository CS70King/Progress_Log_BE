import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const commonWindowsLibreOfficePaths = [
  'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
  'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe'
];

const getLibreOfficeCandidates = () => {
  const envPath = process.env.LIBREOFFICE_PATH?.trim();
  const candidates = envPath ? [envPath] : [];
  return [...candidates, 'soffice', ...commonWindowsLibreOfficePaths];
};

const formatExecError = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return 'Unknown LibreOffice error';
  }

  const stderr = 'stderr' in error && typeof error.stderr === 'string' ? error.stderr.trim() : '';
  const stdout = 'stdout' in error && typeof error.stdout === 'string' ? error.stdout.trim() : '';
  const message = 'message' in error && typeof error.message === 'string' ? error.message : 'Unknown LibreOffice error';

  return stderr || stdout || message;
};

const getExtensionForContentType = (contentType: string, originalFilename: string) => {
  const fromFilename = path.extname(originalFilename).trim();
  if (fromFilename) {
    return fromFilename;
  }

  switch (contentType) {
    case 'application/msword':
      return '.doc';
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return '.docx';
    case 'application/vnd.ms-excel':
      return '.xls';
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return '.xlsx';
    case 'text/csv':
      return '.csv';
    case 'text/plain':
    default:
      return '.txt';
  }
};

const runLibreOffice = async (binaryPath: string, inputPath: string, outputDir: string) => {
  await execFileAsync(
    binaryPath,
    [
      '--headless',
      '--nologo',
      '--nodefault',
      '--nolockcheck',
      '--nofirststartwizard',
      '--convert-to',
      'pdf:writer_pdf_Export',
      '--outdir',
      outputDir,
      inputPath
    ],
    {
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024
    }
  );
};

export class OfficeRenderService {
  static async renderFirstPageSource(
    buffer: Buffer,
    options: {
      contentType: string;
      originalFilename: string;
    }
  ) {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'progress-log-office-preview-'));
    const extension = getExtensionForContentType(options.contentType, options.originalFilename);
    const inputPath = path.join(tempDir, `${crypto.randomUUID()}${extension}`);
    const outputDir = path.join(tempDir, 'output');

    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(inputPath, buffer);

    try {
      const candidates = getLibreOfficeCandidates();
      let lastError: unknown;

      for (const candidate of candidates) {
        try {
          await runLibreOffice(candidate, inputPath, outputDir);

          const outputPdfPath = path.join(
            outputDir,
            `${path.basename(inputPath, path.extname(inputPath))}.pdf`
          );

          await fs.access(outputPdfPath);
          return await fs.readFile(outputPdfPath);
        } catch (error) {
          lastError = error;
        }
      }

      throw new Error(formatExecError(lastError));
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
