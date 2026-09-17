import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { listInventoryHandler } from "../controllers/inventory.controller";

const inventoryRouter = Router();

inventoryRouter.use(authenticate);
inventoryRouter.get(
  "/",
  requireRole(Role.ADMIN, Role.SALES_USER),
  listInventoryHandler
);

export default inventoryRouter;
