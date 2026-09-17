import { Request, Response, NextFunction } from "express";
import { createCustomerSchema } from "../validators/customer.validator";
import { createCustomer, listCustomers } from "../services/customer.service";
import { AppError } from "../middleware/errorHandler";

export async function createCustomerHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = createCustomerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        parsed.error.errors[0]?.message ?? "Invalid customer data",
        400
      );
    }

    const customer = await createCustomer(parsed.data);
    res.status(201).json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
}

export async function listCustomersHandler(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const customers = await listCustomers();
    res.status(200).json({ success: true, data: customers });
  } catch (error) {
    next(error);
  }
}
