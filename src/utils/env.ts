/**
 * Safely retrieves an environment variable and trims any trailing newlines or spaces.
 * This is defensive against issues on platforms like Vercel where secrets might 
 * accidentally include whitespace.
 */
export const getEnv = (key: string): string => {
    const value = process.env[key] || '';
    return value.trim();
};
