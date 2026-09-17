import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import {
  createCustomerHandler,
  listCustomersHandler,
} from "../controllers/customer.controller";

const customerRouter = Router();

customerRouter.use(authenticate);

customerRouter.get(
  "/",
  requireRole(Role.ADMIN, Role.SALES_USER),
  listCustomersHandler
);

customerRouter.post("/", requireRole(Role.SALES_USER), createCustomerHandler);

export default customerRouter;
