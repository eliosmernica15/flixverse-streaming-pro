import { storage } from "@/integrations/firebase/client";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

/**
 * Uploads a file (Blob or File) to Firebase Storage
 * @param file The file or blob to upload
 * @param path The storage path (e.g. 'profile_images/user123')
 * @returns Promise resolving to the download URL
 */
export const uploadToFirebase = async (file: Blob | File, path: string): Promise<string> => {
    try {
        const storageRef = ref(storage, path);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        return downloadURL;
    } catch (error) {
        console.error("Error uploading to Firebase:", error);
        throw error;
    }
};
