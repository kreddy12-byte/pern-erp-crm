import { Request, Response, NextFunction } from "express";
import { loginSchema, registerSchema } from "../validators/auth.validator";
import {
  authenticateWithGoogleProfile,
  loginUser,
  registerUser,
} from "../services/auth.service";
import {
  buildGoogleAuthUrl,
  createOAuthState,
  exchangeGoogleCode,
  isGoogleOAuthConfigured,
  verifyOAuthState,
} from "../services/googleAuth.service";
import { AppError } from "../middleware/errorHandler";
import { env } from "../config/env";

function redirectToLogin(res: Response, errorCode: string): void {
  const url = new URL("/login", env.CLIENT_URL);
  url.searchParams.set("error", errorCode);
  res.redirect(url.toString());
}

export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0]?.message ?? "Invalid login data", 400);
    }

    const result = await loginUser(parsed.data);

    res.status(200).json({
      success: true,
      data: {
        token: result.token,
        user: result.user,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function register(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        parsed.error.errors[0]?.message ?? "Invalid registration data",
        400
      );
    }

    const result = await registerUser(parsed.data);

    res.status(201).json({
      success: true,
      data: {
        token: result.token,
        user: result.user,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function me(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Authentication required", 401);
    }

    res.status(200).json({
      success: true,
      data: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        role: req.user.role,
      },
    });
  } catch (error) {
    next(error);
  }
}

export function googleStart(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    if (!isGoogleOAuthConfigured()) {
      redirectToLogin(res, "google_not_configured");
      return;
    }

    const state = createOAuthState();
    const authUrl = buildGoogleAuthUrl(state);
    res.redirect(authUrl);
  } catch (error) {
    next(error);
  }
}

export async function googleCallback(
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    if (typeof req.query.error === "string") {
      // User cancelled or Google returned an error.
      redirectToLogin(
        res,
        req.query.error === "access_denied" ? "google_cancelled" : "google_failed"
      );
      return;
    }

    if (!isGoogleOAuthConfigured()) {
      redirectToLogin(res, "google_not_configured");
      return;
    }

    const state = typeof req.query.state === "string" ? req.query.state : undefined;
    if (!verifyOAuthState(state)) {
      redirectToLogin(res, "google_failed");
      return;
    }

    const code = typeof req.query.code === "string" ? req.query.code : undefined;
    if (!code) {
      redirectToLogin(res, "google_failed");
      return;
    }

    const profile = await exchangeGoogleCode(code);
    const result = await authenticateWithGoogleProfile(profile);

    const redirectUrl = new URL("/auth/google/callback", env.CLIENT_URL);
    redirectUrl.searchParams.set("token", result.token);
    res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error("Google OAuth callback failed:", error);
    redirectToLogin(res, "google_failed");
  }
}
