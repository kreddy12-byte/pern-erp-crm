import { Request, Response, NextFunction } from "express";
import {
  confirmSalesOrder,
  convertQuotationToSalesOrder,
  getSalesOrderById,
  listSalesOrders,
} from "../services/salesOrder.service";
import { AppError } from "../middleware/errorHandler";

export async function convertQuotationHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id;
    if (!id) {
      throw new AppError("Quotation id is required", 400);
    }

    const order = await convertQuotationToSalesOrder(id);
    res.status(201).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}

export async function listSalesOrdersHandler(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orders = await listSalesOrders();
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
}

export async function getSalesOrderHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id;
    if (!id) {
      throw new AppError("Sales order id is required", 400);
    }

    const order = await getSalesOrderById(id);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}

export async function confirmSalesOrderHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id;
    if (!id) {
      throw new AppError("Sales order id is required", 400);
    }

    const order = await confirmSalesOrder(id);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}
