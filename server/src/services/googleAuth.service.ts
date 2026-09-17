import { OAuth2Client } from "google-auth-library";
import crypto from "crypto";
import { env } from "../config/env";
import { AppError } from "../middleware/errorHandler";
import type { GoogleProfile } from "./auth.service";

const STATE_TTL_MS = 10 * 60 * 1000;

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(
    env.GOOGLE_CLIENT_ID &&
      env.GOOGLE_CLIENT_SECRET &&
      env.GOOGLE_CALLBACK_URL
  );
}

function getOAuthClient(): OAuth2Client {
  if (!isGoogleOAuthConfigured()) {
    throw new AppError(
      "Google sign-in is not configured on this server",
      503
    );
  }

  return new OAuth2Client(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_CALLBACK_URL
  );
}

export function createOAuthState(): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  const issuedAt = Date.now().toString(36);
  const payload = `${issuedAt}.${nonce}`;
  const signature = crypto
    .createHmac("sha256", env.JWT_SECRET)
    .update(payload)
    .digest("hex");
  return `${payload}.${signature}`;
}

export function verifyOAuthState(state: string | undefined): boolean {
  if (!state) return false;
  const parts = state.split(".");
  if (parts.length !== 3) return false;
  const [issuedAt, nonce, signature] = parts;
  if (!issuedAt || !nonce || !signature) return false;

  const payload = `${issuedAt}.${nonce}`;
  const expected = crypto
    .createHmac("sha256", env.JWT_SECRET)
    .update(payload)
    .digest("hex");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return false;

  const issuedMs = parseInt(issuedAt, 36);
  if (!Number.isFinite(issuedMs)) return false;
  if (Date.now() - issuedMs > STATE_TTL_MS) return false;

  return true;
}

export function buildGoogleAuthUrl(state: string): string {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "online",
    prompt: "select_account",
    scope: ["openid", "email", "profile"],
    state,
  });
}

/**
 * Exchange authorization code for tokens and verify the ID token with Google.
 */
export async function exchangeGoogleCode(
  code: string
): Promise<GoogleProfile> {
  const client = getOAuthClient();

  const { tokens } = await client.getToken(code);
  if (!tokens.id_token) {
    throw new AppError("Google did not return an ID token", 400);
  }

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload) {
    throw new AppError("Invalid Google identity token", 401);
  }

  if (payload.email_verified === false) {
    throw new AppError("Google email is not verified", 400);
  }

  if (!payload.sub || !payload.email) {
    throw new AppError("Google account is missing required profile fields", 400);
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name?.trim() || payload.email.split("@")[0] || "Google User",
  };
}
