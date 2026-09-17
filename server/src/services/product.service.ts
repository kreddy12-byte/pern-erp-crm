import { prisma } from "../config/prisma";

export async function listProducts() {
  return prisma.product.findMany({
    orderBy: { productCode: "asc" },
    select: {
      id: true,
      productCode: true,
      productName: true,
      category: true,
      unit: true,
      basePrice: true,
    },
  });
}

export async function getProductsByIds(ids: string[]) {
  return prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
}
