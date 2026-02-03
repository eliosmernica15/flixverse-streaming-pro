/**
 * Safely retrieves an environment variable and trims any trailing newlines or spaces.
 * This is defensive against issues on platforms like Vercel where secrets might 
 * accidentally include whitespace.
 * 
 * Note: Next.js requires static analysis for client-side environment variables.
 * We must reference process.env.NEXT_PUBLIC_* explicitly.
 */
export const getEnv = (key: string): string => {
    // Static mapping for client-side environment variables
    const staticEnv: Record<string, string | undefined> = {
        'NEXT_PUBLIC_FIREBASE_API_KEY': process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN': process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        'NEXT_PUBLIC_FIREBASE_PROJECT_ID': process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET': process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID': process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        'NEXT_PUBLIC_FIREBASE_APP_ID': process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        'NEXT_PUBLIC_TMDB_API_KEY': process.env.NEXT_PUBLIC_TMDB_API_KEY,
        'NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME': process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
        'NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET': process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
    };

    const value = staticEnv[key] || process.env[key] || '';
    return value.trim();
};
