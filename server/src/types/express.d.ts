import "express-serve-static-core";
import type { AuthUser } from "../types/auth";

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

export {};
