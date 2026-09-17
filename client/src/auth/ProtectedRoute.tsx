import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { AuthLoadingScreen } from "../components/AuthLoadingScreen";

export function ProtectedRoute() {
  const {
    isAuthenticated,
    isBootstrapping,
    sessionError,
    token,
    retrySessionRestore,
    logout,
  } = useAuth();
  const location = useLocation();

  // Critical: never treat user===null as logged out while /me is in flight.
  if (isBootstrapping) {
    return <AuthLoadingScreen message="Loading application..." />;
  }

  // Token exists but /me failed for a non-auth reason (network, 5xx).
  // Keep the user off the login page so a refresh/retry can succeed.
  if (sessionError && token && !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">
            Can&apos;t reach the server
          </h1>
          <p className="mt-2 text-sm text-slate-600">{sessionError}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={retrySessionRestore}
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
