import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '@/utils/canvasUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface ImageCropperProps {
    imageSrc: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCropComplete: (croppedBlob: Blob) => void;
    aspect?: number;
}

const ImageCropper = ({
    imageSrc,
    open,
    onOpenChange,
    onCropComplete,
    aspect = 1 // Default to square for profile
}: ImageCropperProps) => {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const onCropChange = (crop: { x: number; y: number }) => {
        setCrop(crop);
    };

    const onZoomChange = (zoom: number) => {
        setZoom(zoom);
    };

    const onCropCompleteCallback = useCallback((croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleSave = async () => {
        if (!imageSrc || !croppedAreaPixels) return;

        setLoading(true);
        try {
            const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
            if (croppedBlob) {
                console.log('Cropped blob size:', croppedBlob.size);
                onCropComplete(croppedBlob);
            } else {
                console.error('getCroppedImg returned null');
            }
        } catch (e) {
            console.error('Error in getCroppedImg:', e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-black/95 border-white/10 text-white">
                <DialogHeader>
                    <DialogTitle>Edit Profile Picture</DialogTitle>
                    <DialogDescription className="hidden">
                        Adjust your profile picture by dragging and zooming.
                    </DialogDescription>
                </DialogHeader>

                <div className="relative w-full h-80 bg-black/50 rounded-md overflow-hidden mt-4">
                    {imageSrc && (
                        <Cropper
                            image={imageSrc}
                            crop={crop}
                            zoom={zoom}
                            aspect={aspect}
                            onCropChange={onCropChange}
                            onCropComplete={onCropCompleteCallback}
                            onZoomChange={onZoomChange}
                            cropShape="round"
                            showGrid={false}
                        />
                    )}
                </div>

                <div className="py-4 space-y-4">
                    <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-400 w-12">Zoom</span>
                        <Slider
                            value={[zoom]}
                            min={1}
                            max={3}
                            step={0.1}
                            onValueChange={(value) => setZoom(value[0])}
                            className="flex-1"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="text-gray-400 hover:text-white hover:bg-white/10"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={loading}
                        className="bg-red-600 hover:bg-red-700 text-white"
                    >
                        {loading ? 'Processing...' : 'Save Picture'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ImageCropper;
