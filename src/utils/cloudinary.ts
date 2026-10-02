// Cloudinary upload utility for profile images
// Uses unsigned upload preset for client-side uploads

const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export interface CloudinaryUploadResult {
    secure_url: string;
    public_id: string;
    width: number;
    height: number;
    format: string;
    bytes: number;
}

export interface CloudinaryError {
    message: string;
    error?: {
        message: string;
    };
}

/**
 * Upload an image to Cloudinary using unsigned upload
 * @param file - File or Blob to upload
 * @param folder - Optional folder path in Cloudinary
 * @returns Promise with the upload result containing the image URL
 */
export async function uploadToCloudinary(
    file: File | Blob,
    folder: string = 'profile_images'
): Promise<CloudinaryUploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', folder);

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
            method: 'POST',
            body: formData,
        }
    );

    if (!response.ok) {
        const error: CloudinaryError = await response.json();
        throw new Error(error.error?.message || error.message || 'Upload failed');
    }

    const result: CloudinaryUploadResult = await response.json();
    return result;
}

/**
 * Delete an image from Cloudinary (requires signed request - server-side only)
 * For client-side apps, you typically don't delete old images or use a server endpoint
 * @param publicId - The public_id of the image to delete
 */
export async function deleteFromCloudinary(publicId: string): Promise<void> {
    // Note: Deletion requires authentication and should be done server-side
    // For now, we'll just log a warning
    console.warn('Cloudinary deletion requires server-side implementation. Public ID:', publicId);
}

/**
 * Get optimized Cloudinary URL with transformations
 * @param url - Original Cloudinary URL
 * @param options - Transformation options
 */
export function getOptimizedUrl(
    url: string,
    options: {
        width?: number;
        height?: number;
        quality?: 'auto' | number;
        format?: 'auto' | 'webp' | 'png' | 'jpg';
    } = {}
): string {
    if (!url.includes('cloudinary.com')) {
        return url;
    }

    const { width = 200, height = 200, quality = 'auto', format = 'auto' } = options;

    // Insert transformation parameters into the URL
    const transformations = `c_fill,w_${width},h_${height},q_${quality},f_${format}`;

    // Cloudinary URLs follow the pattern: .../upload/[transformations]/...
    return url.replace('/upload/', `/upload/${transformations}/`);
}
