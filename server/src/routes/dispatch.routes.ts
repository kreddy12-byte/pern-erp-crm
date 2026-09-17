import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import {
  getDispatchHandler,
  listDispatchesHandler,
} from "../controllers/dispatch.controller";

const dispatchRouter = Router();

dispatchRouter.use(authenticate);

dispatchRouter.get(
  "/",
  requireRole(Role.ADMIN, Role.SALES_USER),
  listDispatchesHandler
);

dispatchRouter.get(
  "/:id",
  requireRole(Role.ADMIN, Role.SALES_USER),
  getDispatchHandler
);

export default dispatchRouter;
