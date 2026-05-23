import sharp from 'sharp';

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
}

export interface ThumbnailResult {
  buffer: Buffer;
  width: number;
  height: number;
  size: number;
}

export class ImageService {
  static async extractMetadata(imageBuffer: Buffer): Promise<ImageMetadata> {
    const metadata = await sharp(imageBuffer).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown'
    };
  }

  static async generateThumbnail(imageBuffer: Buffer): Promise<ThumbnailResult> {
    const thumbnail = await sharp(imageBuffer)
      .resize(300, 300, { 
        fit: 'cover',
        position: 'attention'
      })
      .jpeg({ 
        quality: 80,
        progressive: true 
      })
      .toBuffer({
        resolveWithObject: true
      });
      
    return {
      buffer: thumbnail.data,
      width: thumbnail.info.width,
      height: thumbnail.info.height,
      size: thumbnail.info.size
    };
  }

  static async isImage(buffer: Buffer): Promise<boolean> {
    try {
      const metadata = await sharp(buffer).metadata();
      return !!metadata.format;
    } catch {
      return false;
    }
  }

  static getThumbnailPath(originalPath: string): string {
    const parts = originalPath.split('.');
    parts[parts.length - 2] += '-thumb';
    return parts.join('.');
  }
}
