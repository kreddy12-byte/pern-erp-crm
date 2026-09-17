import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { getUserById } from "../services/auth.service";
import { AppError } from "./errorHandler";

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      throw new AppError("Authentication required", 401);
    }

    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      throw new AppError("Authentication required", 401);
    }

    const payload = verifyAccessToken(token);
    const user = await getUserById(payload.sub);
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}
