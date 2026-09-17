import type { ApiErrorBody, AuthUser, LoginResponse, MeResponse } from "../types/auth";
import { getStoredToken } from "../lib/tokenStorage";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:5000";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function parseError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return new ApiError(body.message || "Request failed", response.status);
  } catch {
    return new ApiError("Request failed", response.status);
  }
}

export function getGoogleAuthStartUrl(): string {
  return `${API_URL}/api/auth/google`;
}

export async function loginRequest(
  email: string,
  password: string
): Promise<LoginResponse["data"]> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  const body = (await response.json()) as LoginResponse;
  return body.data;
}

export async function registerRequest(input: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}): Promise<LoginResponse["data"]> {
  const response = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  const body = (await response.json()) as LoginResponse;
  return body.data;
}

export async function fetchCurrentUser(token?: string): Promise<AuthUser> {
  const accessToken = token ?? getStoredToken();
  if (!accessToken) {
    throw new ApiError("Authentication required", 401);
  }

  const response = await fetch(`${API_URL}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  // Do not clear storage here — AuthContext owns session invalidation
  // to avoid StrictMode / race wiping a still-valid token.
  if (!response.ok) {
    throw await parseError(response);
  }

  const body = (await response.json()) as MeResponse;
  return body.data;
}
