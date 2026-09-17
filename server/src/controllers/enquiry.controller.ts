import { Request, Response, NextFunction } from "express";
import { createEnquirySchema } from "../validators/enquiry.validator";
import {
  createEnquiry,
  getEnquiryById,
  listEnquiries,
} from "../services/enquiry.service";
import { AppError } from "../middleware/errorHandler";

export async function createEnquiryHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = createEnquirySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(
        parsed.error.errors[0]?.message ?? "Invalid enquiry data",
        400
      );
    }

    // Status is always NEW — ignore any client-supplied status.
    const enquiry = await createEnquiry(parsed.data);
    res.status(201).json({ success: true, data: enquiry });
  } catch (error) {
    next(error);
  }
}

export async function listEnquiriesHandler(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const enquiries = await listEnquiries();
    res.status(200).json({ success: true, data: enquiries });
  } catch (error) {
    next(error);
  }
}

export async function getEnquiryHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id;
    if (!id) {
      throw new AppError("Enquiry id is required", 400);
    }

    const enquiry = await getEnquiryById(id);
    res.status(200).json({ success: true, data: enquiry });
  } catch (error) {
    next(error);
  }
}
