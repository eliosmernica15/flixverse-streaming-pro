import { WifiOff } from "lucide-react";

export default function OfflineLoading() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <WifiOff className="w-10 h-10 text-amber-400 animate-pulse" />
    </div>
  );
}
