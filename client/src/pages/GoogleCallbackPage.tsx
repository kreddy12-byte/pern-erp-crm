import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { AuthLoadingScreen } from "../components/AuthLoadingScreen";

export function GoogleCallbackPage() {
  const { completeSession, isAuthenticated, isBootstrapping } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    // Wait until AuthProvider finished its own restore so we don't race token clears.
    if (isBootstrapping) return;

    const token = searchParams.get("token");
    if (!token) {
      setError("Missing Google sign-in token.");
      return;
    }

    if (isAuthenticated) {
      navigate("/app", { replace: true });
      return;
    }

    let cancelled = false;

    async function finish() {
      setCompleting(true);
      try {
        await completeSession(token!);
        if (!cancelled) {
          navigate("/app", { replace: true });
        }
      } catch {
        if (!cancelled) {
          setError("Unable to complete Google sign-in.");
        }
      } finally {
        if (!cancelled) {
          setCompleting(false);
        }
      }
    }

    void finish();

    return () => {
      cancelled = true;
    };
  }, [
    completeSession,
    isAuthenticated,
    isBootstrapping,
    navigate,
    searchParams,
  ]);

  if (isBootstrapping || completing) {
    return <AuthLoadingScreen message="Completing Google sign-in..." />;
  }

  if (isAuthenticated && !error) {
    return <Navigate to="/app" replace />;
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-red-700">{error}</p>
          <Link
            to="/login"
            className="mt-4 inline-block text-sm font-semibold text-slate-900 underline"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return <AuthLoadingScreen message="Completing Google sign-in..." />;
}
