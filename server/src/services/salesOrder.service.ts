import { Prisma, SalesOrderStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../middleware/errorHandler";

const salesOrderInclude = {
  customer: {
    select: {
      id: true,
      companyName: true,
      contactPerson: true,
      mobile: true,
      email: true,
      city: true,
    },
  },
  quotation: {
    select: {
      id: true,
      quotationNumber: true,
      status: true,
      grandTotal: true,
      enquiry: {
        select: {
          id: true,
          enquiryNumber: true,
          status: true,
        },
      },
    },
  },
  items: {
    include: {
      product: {
        select: {
          id: true,
          productCode: true,
          productName: true,
          category: true,
          unit: true,
          basePrice: true,
          inventory: {
            select: {
              physicalQuantity: true,
              reservedQuantity: true,
            },
          },
        },
      },
    },
  },
  dispatch: {
    select: {
      id: true,
      dispatchNumber: true,
      dispatchDate: true,
      vehicleNumber: true,
      driverName: true,
    },
  },
} as const;

function serializeSalesOrder<
  T extends {
    totalAmount: Prisma.Decimal;
    items: Array<{
      unitPrice: Prisma.Decimal;
      lineAmount: Prisma.Decimal;
      product: {
        basePrice: Prisma.Decimal;
        inventory: {
          physicalQuantity: number;
          reservedQuantity: number;
        } | null;
      };
    }>;
    quotation: { grandTotal: Prisma.Decimal };
  },
>(order: T) {
  return {
    ...order,
    totalAmount: order.totalAmount.toFixed(2),
    quotation: {
      ...order.quotation,
      grandTotal: order.quotation.grandTotal.toFixed(2),
    },
    items: order.items.map((item) => {
      const physical = item.product.inventory?.physicalQuantity ?? 0;
      const reserved = item.product.inventory?.reservedQuantity ?? 0;
      return {
        ...item,
        unitPrice: item.unitPrice.toFixed(2),
        lineAmount: item.lineAmount.toFixed(2),
        product: {
          ...item.product,
          basePrice: item.product.basePrice.toFixed(2),
          inventory: item.product.inventory
            ? {
                physicalQuantity: physical,
                reservedQuantity: reserved,
                availableQuantity: physical - reserved,
              }
            : null,
        },
      };
    }),
  };
}

async function allocateOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
  const orders = await tx.salesOrder.findMany({
    select: { orderNumber: true },
  });

  let max = 0;
  for (const row of orders) {
    const match = row.orderNumber.match(/^SO-(\d+)$/);
    if (match) {
      max = Math.max(max, Number.parseInt(match[1], 10));
    }
  }

  return `SO-${String(max + 1).padStart(6, "0")}`;
}

export async function convertQuotationToSalesOrder(quotationId: string) {
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: {
      items: true,
      salesOrder: { select: { id: true, orderNumber: true } },
    },
  });

  if (!quotation) {
    throw new AppError("Quotation not found", 404);
  }

  if (quotation.status !== "ACCEPTED") {
    throw new AppError("Only ACCEPTED quotations can be converted to a sales order", 400);
  }

  if (quotation.items.length === 0) {
    throw new AppError("Quotation has no items", 400);
  }

  if (quotation.salesOrder) {
    throw new AppError(
      `Sales order already exists for this quotation (${quotation.salesOrder.orderNumber})`,
      409
    );
  }

  try {
    const created = await prisma.$transaction(
      async (tx) => {
        const orderNumber = await allocateOrderNumber(tx);

        return tx.salesOrder.create({
          data: {
            orderNumber,
            customerId: quotation.customerId,
            quotationId: quotation.id,
            orderDate: new Date(),
            totalAmount: quotation.grandTotal,
            status: SalesOrderStatus.PENDING,
            items: {
              create: quotation.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                lineAmount: item.lineAmount,
              })),
            },
          },
          include: salesOrderInclude,
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    return serializeSalesOrder(created);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError("Sales order already exists for this quotation", 409);
    }
    throw error;
  }
}

export async function listSalesOrders() {
  const orders = await prisma.salesOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: salesOrderInclude,
  });
  return orders.map(serializeSalesOrder);
}

export async function getSalesOrderById(id: string) {
  const order = await prisma.salesOrder.findUnique({
    where: { id },
    include: salesOrderInclude,
  });

  if (!order) {
    throw new AppError("Sales order not found", 404);
  }

  return serializeSalesOrder(order);
}

/**
 * Confirm a PENDING sales order and reserve inventory atomically.
 *
 * Concurrency: each product reservation uses a conditional UPDATE that only
 * succeeds when (physicalQuantity - reservedQuantity) >= requested qty.
 * Combined with a Prisma transaction, concurrent confirmations cannot push
 * reservedQuantity above physicalQuantity, and a failure rolls back all
 * reservations for this order (no partial reserve).
 */
export async function confirmSalesOrder(id: string) {
  try {
    const confirmed = await prisma.$transaction(
      async (tx) => {
        const order = await tx.salesOrder.findUnique({
          where: { id },
          include: {
            items: {
              include: {
                product: {
                  select: { id: true, productCode: true, productName: true },
                },
              },
            },
          },
        });

        if (!order) {
          throw new AppError("Sales order not found", 404);
        }

        if (order.status === SalesOrderStatus.CONFIRMED) {
          throw new AppError("Sales order is already confirmed", 409);
        }

        if (order.status !== SalesOrderStatus.PENDING) {
          throw new AppError(
            `Only PENDING sales orders can be confirmed (current: ${order.status})`,
            400
          );
        }

        if (order.items.length === 0) {
          throw new AppError("Sales order has no items", 400);
        }

        for (const item of order.items) {
          // Atomic conditional reservation — fails if available stock is insufficient.
          const updatedCount = await tx.$executeRaw`
            UPDATE "Inventory"
            SET
              "reservedQuantity" = "reservedQuantity" + ${item.quantity},
              "updatedAt" = CURRENT_TIMESTAMP
            WHERE "productId" = ${item.productId}
              AND ("physicalQuantity" - "reservedQuantity") >= ${item.quantity}
          `;

          if (updatedCount === 0) {
            const inventory = await tx.inventory.findUnique({
              where: { productId: item.productId },
            });

            const available = inventory
              ? inventory.physicalQuantity - inventory.reservedQuantity
              : 0;

            throw new AppError(
              `Insufficient available inventory for product ${item.product.productCode} (requested ${item.quantity}, available ${available})`,
              400
            );
          }
        }

        return tx.salesOrder.update({
          where: { id: order.id },
          data: { status: SalesOrderStatus.CONFIRMED },
          include: salesOrderInclude,
        });
      },
      {
        // Serializable + conditional UPDATE provides belt-and-suspenders protection
        // against overselling under concurrent confirmations.
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 15000,
      }
    );

    return serializeSalesOrder(confirmed);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      throw new AppError(
        "Could not confirm sales order due to a concurrent update. Please retry.",
        409
      );
    }
    throw error;
  }
}
