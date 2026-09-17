import { Request, Response, NextFunction } from "express";
import { listProducts } from "../services/product.service";

export async function listProductsHandler(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const products = await listProducts();
    res.status(200).json({
      success: true,
      data: products.map((product) => ({
        ...product,
        basePrice: product.basePrice.toString(),
      })),
    });
  } catch (error) {
    next(error);
  }
}
