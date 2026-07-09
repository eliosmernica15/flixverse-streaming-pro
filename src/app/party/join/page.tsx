import { Suspense } from "react";
import PartyJoinClient from "./PartyJoinClient";

export default function PartyJoinPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center text-gray-400 text-sm">
          Loading party…
        </div>
      }
    >
      <PartyJoinClient />
    </Suspense>
  );
}
