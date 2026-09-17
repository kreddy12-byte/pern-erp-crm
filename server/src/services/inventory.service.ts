import { prisma } from "../config/prisma";

export async function listInventory() {
  const rows = await prisma.inventory.findMany({
    orderBy: {
      product: { productCode: "asc" },
    },
    include: {
      product: {
        select: {
          id: true,
          productCode: true,
          productName: true,
          category: true,
          unit: true,
          basePrice: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    productId: row.productId,
    physicalQuantity: row.physicalQuantity,
    reservedQuantity: row.reservedQuantity,
    availableQuantity: row.physicalQuantity - row.reservedQuantity,
    product: {
      ...row.product,
      basePrice: row.product.basePrice.toFixed(2),
    },
  }));
}
