import { Router } from "express";
import healthRouter from "./health.routes";
import authRouter from "./auth.routes";
import customerRouter from "./customer.routes";
import productRouter from "./product.routes";
import enquiryRouter from "./enquiry.routes";
import quotationRouter from "./quotation.routes";
import salesOrderRouter from "./salesOrder.routes";
import inventoryRouter from "./inventory.routes";
import dispatchRouter from "./dispatch.routes";

const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/customers", customerRouter);
apiRouter.use("/products", productRouter);
apiRouter.use("/enquiries", enquiryRouter);
apiRouter.use("/quotations", quotationRouter);
apiRouter.use("/sales-orders", salesOrderRouter);
apiRouter.use("/inventory", inventoryRouter);
apiRouter.use("/dispatches", dispatchRouter);

export default apiRouter;
