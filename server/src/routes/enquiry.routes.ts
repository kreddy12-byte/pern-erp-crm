import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import {
  createEnquiryHandler,
  getEnquiryHandler,
  listEnquiriesHandler,
} from "../controllers/enquiry.controller";

const enquiryRouter = Router();

enquiryRouter.use(authenticate);

enquiryRouter.get(
  "/",
  requireRole(Role.ADMIN, Role.SALES_USER),
  listEnquiriesHandler
);

enquiryRouter.get(
  "/:id",
  requireRole(Role.ADMIN, Role.SALES_USER),
  getEnquiryHandler
);

enquiryRouter.post("/", requireRole(Role.SALES_USER), createEnquiryHandler);

export default enquiryRouter;
