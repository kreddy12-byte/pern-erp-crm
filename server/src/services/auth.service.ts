import { Prisma, Role } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../middleware/errorHandler";
import { hashPassword, verifyPassword } from "../utils/password";
import { signAccessToken } from "../utils/jwt";
import type { LoginInput, RegisterInput } from "../validators/auth.validator";
import type { AuthUser } from "../types/auth";

function toSafeUser(user: {
  id: string;
  email: string;
  name: string;
  role: AuthUser["role"];
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

function issueAuthSession(user: {
  id: string;
  email: string;
  name: string;
  role: AuthUser["role"];
}): { token: string; user: AuthUser } {
  const safeUser = toSafeUser(user);
  const token = signAccessToken({
    sub: safeUser.id,
    email: safeUser.email,
    role: safeUser.role,
  });
  return { token, user: safeUser };
}

export async function loginUser(input: LoginInput): Promise<{
  token: string;
  user: AuthUser;
}> {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  // Generic message — do not reveal whether email or password was wrong.
  if (!user || !user.passwordHash) {
    throw new AppError("Invalid email or password", 401);
  }

  const passwordMatches = await verifyPassword(input.password, user.passwordHash);
  if (!passwordMatches) {
    throw new AppError("Invalid email or password", 401);
  }

  return issueAuthSession(user);
}

export async function registerUser(input: RegisterInput): Promise<{
  token: string;
  user: AuthUser;
}> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError("An account with this email already exists", 409);
  }

  const passwordHash = await hashPassword(input.password);

  try {
    // Public signup is always SALES_USER — never ADMIN.
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: Role.SALES_USER,
      },
    });

    return issueAuthSession(user);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError("An account with this email already exists", 409);
    }
    throw error;
  }
}

export type GoogleProfile = {
  googleId: string;
  email: string;
  name: string;
};

/**
 * Find or create a local user from a verified Google profile.
 * Existing roles are preserved; new users are always SALES_USER.
 */
export async function authenticateWithGoogleProfile(
  profile: GoogleProfile
): Promise<{ token: string; user: AuthUser }> {
  const email = profile.email.trim().toLowerCase();
  const name = profile.name.trim() || email.split("@")[0] || "Google User";
  const googleId = profile.googleId;

  if (!email || !googleId) {
    throw new AppError("Google account did not provide a verified email", 400);
  }

  const byGoogleId = await prisma.user.findUnique({ where: { googleId } });
  if (byGoogleId) {
    if (byGoogleId.email !== email) {
      // Keep email in sync with Google's verified address when the subject matches.
      const updated = await prisma.user.update({
        where: { id: byGoogleId.id },
        data: { email, name: byGoogleId.name || name },
      });
      return issueAuthSession(updated);
    }
    return issueAuthSession(byGoogleId);
  }

  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail) {
    // Link Google identity to the existing local account; preserve role.
    const linked = await prisma.user.update({
      where: { id: byEmail.id },
      data: {
        googleId,
        name: byEmail.name || name,
      },
    });
    return issueAuthSession(linked);
  }

  try {
    const created = await prisma.user.create({
      data: {
        name,
        email,
        googleId,
        passwordHash: null,
        role: Role.SALES_USER,
      },
    });
    return issueAuthSession(created);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // Race: another request created the user — retry lookup.
      const raced = await prisma.user.findFirst({
        where: { OR: [{ email }, { googleId }] },
      });
      if (raced) {
        return issueAuthSession(raced);
      }
      throw new AppError("Unable to complete Google sign-in", 409);
    }
    throw error;
  }
}

export async function getUserById(userId: string): Promise<AuthUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });

  if (!user) {
    throw new AppError("User not found", 401);
  }

  return toSafeUser(user);
}
