type AuthLoadingScreenProps = {
  message?: string;
};

export function AuthLoadingScreen({
  message = "Loading application...",
}: AuthLoadingScreenProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4">
      <div
        className="h-9 w-9 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900"
        aria-hidden
      />
      <div className="text-center">
        <p className="text-sm font-medium text-slate-900">{message}</p>
        <p className="mt-1 text-xs text-slate-500">Restoring your session</p>
      </div>
    </div>
  );
}
