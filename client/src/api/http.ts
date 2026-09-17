import { getStoredToken } from "../lib/tokenStorage";

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:5000";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type ErrorBody = {
  success?: false;
  message?: string;
};

async function parseError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as ErrorBody;
    return new ApiError(body.message || "Request failed", response.status);
  } catch {
    return new ApiError("Request failed", response.status);
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  authenticated = true
): Promise<T> {
  const headers = new Headers(options.headers ?? {});

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (authenticated) {
    const token = getStoredToken();
    if (!token) {
      throw new ApiError("Authentication required", 401);
    }
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  // Leave token clearing to AuthContext.logout / session restore so
  // concurrent requests cannot wipe a valid session mid-bootstrap.
  if (!response.ok) {
    throw await parseError(response);
  }

  return (await response.json()) as T;
}
