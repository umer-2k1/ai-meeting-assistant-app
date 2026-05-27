import { v2 as cloudinary } from 'cloudinary';
import fs from 'node:fs';

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

// Configure Cloudinary
if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  });
}

export interface UploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  format: string;
  duration?: number;
  bytes: number;
}

/**
 * Upload audio file to Cloudinary
 */
export async function uploadAudio(
  filePath: string,
  options: {
    publicId?: string;
    folder?: string;
  } = {}
): Promise<UploadResult> {
  if (!CLOUDINARY_CLOUD_NAME) {
    throw new Error('Cloudinary not configured');
  }

  try {
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: 'video', // Audio files are uploaded as 'video' type in Cloudinary
      public_id: options.publicId,
      folder: options.folder || 'meeting-recordings',
      format: 'mp3', // Convert to MP3 for better compatibility
      audio_codec: 'mp3',
    });

    return {
      url: result.url,
      secureUrl: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      duration: result.duration,
      bytes: result.bytes,
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error('Failed to upload audio to Cloudinary');
  }
}

/**
 * Delete audio file from Cloudinary
 */
export async function deleteAudio(publicId: string): Promise<void> {
  if (!CLOUDINARY_CLOUD_NAME) {
    throw new Error('Cloudinary not configured');
  }

  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: 'video',
    });
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw new Error('Failed to delete audio from Cloudinary');
  }
}

/**
 * Upload local file and delete after upload
 */
export async function uploadAndCleanup(
  filePath: string,
  options: {
    publicId?: string;
    folder?: string;
  } = {}
): Promise<UploadResult> {
  const result = await uploadAudio(filePath, options);

  // Delete local file after successful upload
  try {
    fs.unlinkSync(filePath);
  } catch (error) {
    console.warn('Failed to delete local file:', error);
  }

  return result;
}
