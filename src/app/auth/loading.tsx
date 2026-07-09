export default function Loading() {
  return (
    <div className="min-h-screen auth-bg flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="auth-orb auth-orb-red" />
        <div className="auth-orb auth-orb-purple" />
      </div>
      <div className="relative z-10 w-full max-w-md glass-panel glass-strong rounded-3xl p-8">
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="h-12 w-12 rounded-2xl skeleton" />
          <div className="h-6 w-44 skeleton rounded-full" />
        </div>
        <div className="space-y-4">
          <div className="h-14 w-full skeleton rounded-xl" />
          <div className="h-14 w-full skeleton rounded-xl" />
          <div className="h-14 w-full skeleton rounded-xl" />
          <div className="h-14 w-full skeleton rounded-xl mt-2" />
        </div>
      </div>
    </div>
  );
}
