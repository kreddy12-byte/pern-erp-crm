import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import {
  confirmSalesOrderHandler,
  getSalesOrderHandler,
  listSalesOrdersHandler,
} from "../controllers/salesOrder.controller";
import { dispatchSalesOrderHandler } from "../controllers/dispatch.controller";

const salesOrderRouter = Router();

salesOrderRouter.use(authenticate);

salesOrderRouter.get(
  "/",
  requireRole(Role.ADMIN, Role.SALES_USER),
  listSalesOrdersHandler
);

salesOrderRouter.get(
  "/:id",
  requireRole(Role.ADMIN, Role.SALES_USER),
  getSalesOrderHandler
);

salesOrderRouter.post(
  "/:id/confirm",
  requireRole(Role.ADMIN),
  confirmSalesOrderHandler
);

salesOrderRouter.post(
  "/:id/dispatch",
  requireRole(Role.ADMIN),
  dispatchSalesOrderHandler
);

export default salesOrderRouter;
