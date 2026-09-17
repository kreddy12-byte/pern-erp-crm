import { Request, Response, NextFunction } from "express";
import { createDispatchSchema } from "../validators/dispatch.validator";
import {
  dispatchSalesOrder,
  getDispatchById,
  listDispatches,
} from "../services/dispatch.service";
import { AppError } from "../middleware/errorHandler";

export async function dispatchSalesOrderHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id;
    if (!id) {
      throw new AppError("Sales order id is required", 400);
    }

    const parsed = createDispatchSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        parsed.error.errors[0]?.message ?? "Invalid dispatch data",
        400
      );
    }

    const dispatch = await dispatchSalesOrder(id, parsed.data);
    res.status(201).json({ success: true, data: dispatch });
  } catch (error) {
    next(error);
  }
}

export async function listDispatchesHandler(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const dispatches = await listDispatches();
    res.status(200).json({ success: true, data: dispatches });
  } catch (error) {
    next(error);
  }
}

export async function getDispatchHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id;
    if (!id) {
      throw new AppError("Dispatch id is required", 400);
    }

    const dispatch = await getDispatchById(id);
    res.status(200).json({ success: true, data: dispatch });
  } catch (error) {
    next(error);
  }
}
