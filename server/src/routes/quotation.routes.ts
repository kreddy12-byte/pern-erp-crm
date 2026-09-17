import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import {
  createQuotationHandler,
  getQuotationHandler,
  listQuotationsHandler,
  updateQuotationStatusHandler,
} from "../controllers/quotation.controller";
import { convertQuotationHandler } from "../controllers/salesOrder.controller";

const quotationRouter = Router();

quotationRouter.use(authenticate);

quotationRouter.get(
  "/",
  requireRole(Role.ADMIN, Role.SALES_USER),
  listQuotationsHandler
);

quotationRouter.get(
  "/:id",
  requireRole(Role.ADMIN, Role.SALES_USER),
  getQuotationHandler
);

quotationRouter.post("/", requireRole(Role.SALES_USER), createQuotationHandler);

quotationRouter.post(
  "/:id/convert",
  requireRole(Role.SALES_USER),
  convertQuotationHandler
);

quotationRouter.patch(
  "/:id/status",
  requireRole(Role.ADMIN),
  updateQuotationStatusHandler
);

export default quotationRouter;
