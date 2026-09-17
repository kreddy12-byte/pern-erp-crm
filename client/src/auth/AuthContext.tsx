import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ApiError,
  fetchCurrentUser,
  loginRequest,
  registerRequest,
} from "../api/authApi";
import {
  clearStoredToken,
  getStoredToken,
  storeToken,
} from "../lib/tokenStorage";
import type { AuthUser } from "../types/auth";

type RegisterInput = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  /** True while checking localStorage + /api/auth/me on startup. */
  isBootstrapping: boolean;
  /** Non-auth failure while restoring (network etc.) — token kept. */
  sessionError: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  completeSession: (token: string) => Promise<void>;
  logout: () => void;
  retrySessionRestore: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [restoreNonce, setRestoreNonce] = useState(0);
  const restoreIdRef = useRef(0);

  useEffect(() => {
    const restoreId = ++restoreIdRef.current;
    let cancelled = false;

    async function restoreSession() {
      const stored = getStoredToken();

      if (!stored) {
        if (!cancelled && restoreId === restoreIdRef.current) {
          setUser(null);
          setToken(null);
          setSessionError(null);
          setIsBootstrapping(false);
        }
        return;
      }

      if (!cancelled && restoreId === restoreIdRef.current) {
        setIsBootstrapping(true);
        setSessionError(null);
        setToken(stored);
      }

      try {
        const currentUser = await fetchCurrentUser(stored);

        // Ignore stale StrictMode / superseded restores — never clear token here.
        if (cancelled || restoreId !== restoreIdRef.current) {
          return;
        }

        setUser(currentUser);
        setToken(stored);
        setSessionError(null);
      } catch (error) {
        if (cancelled || restoreId !== restoreIdRef.current) {
          return;
        }

        const status = error instanceof ApiError ? error.status : 0;

        // Only invalidate the session on definitive auth failure.
        if (status === 401) {
          clearStoredToken();
          setUser(null);
          setToken(null);
          setSessionError(null);
        } else {
          // Keep token so refresh can retry; do not bounce to login.
          setSessionError(
            error instanceof Error
              ? error.message
              : "Unable to restore your session. Check that the API is running."
          );
        }
      } finally {
        if (!cancelled && restoreId === restoreIdRef.current) {
          setIsBootstrapping(false);
        }
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, [restoreNonce]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginRequest(email, password);
    storeToken(result.token);
    setToken(result.token);
    setUser(result.user);
    setSessionError(null);
    setIsBootstrapping(false);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const result = await registerRequest(input);
    storeToken(result.token);
    setToken(result.token);
    setUser(result.user);
    setSessionError(null);
    setIsBootstrapping(false);
  }, []);

  const completeSession = useCallback(async (accessToken: string) => {
    const currentUser = await fetchCurrentUser(accessToken);
    storeToken(accessToken);
    setToken(accessToken);
    setUser(currentUser);
    setSessionError(null);
    setIsBootstrapping(false);
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    setToken(null);
    setUser(null);
    setSessionError(null);
    setIsBootstrapping(false);
  }, []);

  const retrySessionRestore = useCallback(() => {
    setIsBootstrapping(true);
    setSessionError(null);
    setRestoreNonce((n) => n + 1);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      // Require both — never treat null user as logged-out while bootstrapping.
      isAuthenticated: Boolean(user && token),
      isBootstrapping,
      sessionError,
      login,
      register,
      completeSession,
      logout,
      retrySessionRestore,
    }),
    [
      user,
      token,
      isBootstrapping,
      sessionError,
      login,
      register,
      completeSession,
      logout,
      retrySessionRestore,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
