import { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { AppError } from "./errorHandler";

/**
 * Backend RBAC middleware.
 * Authorization is derived from the authenticated JWT/user identity — never from the frontend.
 *
 * Intended later-phase usage:
 * - ADMIN: view all records, manage inventory, confirm sales orders, process dispatch
 * - SALES_USER: create customers/enquiries/quotations, convert accepted quotations, view inventory
 */
export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError("Authentication required", 401));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(new AppError("Forbidden: insufficient permissions", 403));
      return;
    }

    next();
  };
}
