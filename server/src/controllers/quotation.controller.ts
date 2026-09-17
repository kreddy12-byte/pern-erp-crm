import { Request, Response, NextFunction } from "express";
import {
  createQuotationSchema,
  updateQuotationStatusSchema,
} from "../validators/quotation.validator";
import {
  createQuotation,
  getQuotationById,
  listQuotations,
  updateQuotationStatus,
} from "../services/quotation.service";
import { AppError } from "../middleware/errorHandler";

export async function createQuotationHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = createQuotationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        parsed.error.errors[0]?.message ?? "Invalid quotation data",
        400
      );
    }

    const quotation = await createQuotation(parsed.data);
    res.status(201).json({ success: true, data: quotation });
  } catch (error) {
    next(error);
  }
}

export async function listQuotationsHandler(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const quotations = await listQuotations();
    res.status(200).json({ success: true, data: quotations });
  } catch (error) {
    next(error);
  }
}

export async function getQuotationHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id;
    if (!id) {
      throw new AppError("Quotation id is required", 400);
    }

    const quotation = await getQuotationById(id);
    res.status(200).json({ success: true, data: quotation });
  } catch (error) {
    next(error);
  }
}

export async function updateQuotationStatusHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id;
    if (!id) {
      throw new AppError("Quotation id is required", 400);
    }

    const parsed = updateQuotationStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        parsed.error.errors[0]?.message ?? "Invalid status update",
        400
      );
    }

    const quotation = await updateQuotationStatus(id, parsed.data.status);
    res.status(200).json({ success: true, data: quotation });
  } catch (error) {
    next(error);
  }
}
