import { Request, Response, NextFunction } from "express";
import { listInventory } from "../services/inventory.service";

export async function listInventoryHandler(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const inventory = await listInventory();
    res.status(200).json({ success: true, data: inventory });
  } catch (error) {
    next(error);
  }
}
