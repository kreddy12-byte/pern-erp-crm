import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { listProductsHandler } from "../controllers/product.controller";

const productRouter = Router();

productRouter.use(authenticate);
productRouter.get(
  "/",
  requireRole(Role.ADMIN, Role.SALES_USER),
  listProductsHandler
);

export default productRouter;
