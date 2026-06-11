import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { ImageService, ThumbnailResult } from './imageService';

const execFileAsync = promisify(execFile);
const bundledFfmpegPath = require('ffmpeg-static') as string | null;

export interface VideoThumbnailResult {
  thumbnail: ThumbnailResult;
  width: number;
  height: number;
}

const getFfmpegPath = () => process.env.FFMPEG_PATH?.trim() || bundledFfmpegPath || 'ffmpeg';

const getInputExtension = (contentType: string, originalFilename?: string) => {
  const originalExtension = path.extname(originalFilename ?? '').trim();
  if (originalExtension) {
    return originalExtension;
  }

  switch (contentType) {
    case 'video/quicktime':
      return '.mov';
    case 'video/webm':
      return '.webm';
    case 'video/mp4':
    default:
      return '.mp4';
  }
};

const formatFfmpegError = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return 'Unknown ffmpeg error';
  }

  const stderr = 'stderr' in error && typeof error.stderr === 'string' ? error.stderr.trim() : '';
  const message = 'message' in error && typeof error.message === 'string' ? error.message : 'Unknown ffmpeg error';
  return stderr || message;
};

const runFfmpeg = async (ffmpegPath: string, args: string[]) => {
  try {
    await execFileAsync(ffmpegPath, args, {
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024
    });
  } catch (error) {
    throw new Error(formatFfmpegError(error));
  }
};

export class VideoThumbnailService {
  static async generateThumbnail(
    videoBuffer: Buffer,
    options: {
      contentType: string;
      originalFilename?: string;
      frameTimestampSeconds?: number;
    }
  ): Promise<VideoThumbnailResult> {
    const ffmpegPath = getFfmpegPath();
    const frameTimestampSeconds = options.frameTimestampSeconds ?? 1;
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'progress-log-video-thumb-'));
    const inputPath = path.join(
      tempDir,
      `${crypto.randomUUID()}${getInputExtension(options.contentType, options.originalFilename)}`
    );
    const framePath = path.join(tempDir, `${crypto.randomUUID()}.jpg`);

    try {
      await fs.writeFile(inputPath, videoBuffer);

      const attempts = [
        ['-y', '-ss', String(frameTimestampSeconds), '-i', inputPath, '-frames:v', '1', '-q:v', '2', framePath],
        ['-y', '-i', inputPath, '-frames:v', '1', '-q:v', '2', framePath]
      ];

      let lastError: unknown;

      for (const args of attempts) {
        try {
          await runFfmpeg(ffmpegPath, args);
          const frameBuffer = await fs.readFile(framePath);
          const metadata = await ImageService.extractMetadata(frameBuffer);
          const thumbnail = await ImageService.generateThumbnail(frameBuffer);

          return {
            thumbnail,
            width: metadata.width,
            height: metadata.height
          };
        } catch (error) {
          lastError = error;
          await fs.rm(framePath, { force: true }).catch(() => undefined);
        }
      }

      throw lastError instanceof Error ? lastError : new Error('Failed to extract a video frame');
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
