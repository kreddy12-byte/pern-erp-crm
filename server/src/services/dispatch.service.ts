import { Prisma, SalesOrderStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../middleware/errorHandler";
import type { CreateDispatchInput } from "../validators/dispatch.validator";

const dispatchInclude = {
  salesOrder: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      orderDate: true,
      totalAmount: true,
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
          enquiry: {
            select: {
              id: true,
              enquiryNumber: true,
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
            },
          },
        },
      },
    },
  },
} as const;

function serializeDispatch<
  T extends {
    salesOrder: {
      totalAmount: Prisma.Decimal;
      items: Array<{
        unitPrice: Prisma.Decimal;
        lineAmount: Prisma.Decimal;
        product: { basePrice: Prisma.Decimal };
      }>;
    };
  },
>(dispatch: T) {
  return {
    ...dispatch,
    salesOrder: {
      ...dispatch.salesOrder,
      totalAmount: dispatch.salesOrder.totalAmount.toFixed(2),
      items: dispatch.salesOrder.items.map((item) => ({
        ...item,
        unitPrice: item.unitPrice.toFixed(2),
        lineAmount: item.lineAmount.toFixed(2),
        product: {
          ...item.product,
          basePrice: item.product.basePrice.toFixed(2),
        },
      })),
    },
  };
}

async function allocateDispatchNumber(
  tx: Prisma.TransactionClient
): Promise<string> {
  const rows = await tx.dispatch.findMany({
    select: { dispatchNumber: true },
  });

  let max = 0;
  for (const row of rows) {
    const match = row.dispatchNumber.match(/^DIS-(\d+)$/);
    if (match) {
      max = Math.max(max, Number.parseInt(match[1], 10));
    }
  }

  return `DIS-${String(max + 1).padStart(6, "0")}`;
}

/**
 * Full Sales Order dispatch (no partial dispatch).
 * Products/quantities come from SalesOrderItem rows — Dispatch has no JSON payload.
 *
 * Inventory effect per item quantity Q:
 *   physicalQuantity -= Q
 *   reservedQuantity -= Q
 * Available (= physical - reserved) is unchanged by a correct full dispatch of reserved stock.
 */
export async function dispatchSalesOrder(
  salesOrderId: string,
  input: CreateDispatchInput
) {
  try {
    const created = await prisma.$transaction(
      async (tx) => {
        const order = await tx.salesOrder.findUnique({
          where: { id: salesOrderId },
          include: {
            items: {
              include: {
                product: {
                  select: { id: true, productCode: true, productName: true },
                },
              },
            },
            dispatch: { select: { id: true, dispatchNumber: true } },
          },
        });

        if (!order) {
          throw new AppError("Sales order not found", 404);
        }

        if (order.dispatch) {
          throw new AppError(
            `Sales order already dispatched (${order.dispatch.dispatchNumber})`,
            409
          );
        }

        if (order.status === SalesOrderStatus.DISPATCHED) {
          throw new AppError("Sales order is already dispatched", 409);
        }

        if (order.status === SalesOrderStatus.CANCELLED) {
          throw new AppError("Cancelled sales orders cannot be dispatched", 400);
        }

        if (order.status === SalesOrderStatus.PENDING) {
          throw new AppError("Only CONFIRMED sales orders can be dispatched", 400);
        }

        if (order.status !== SalesOrderStatus.CONFIRMED) {
          throw new AppError(
            `Only CONFIRMED sales orders can be dispatched (current: ${order.status})`,
            400
          );
        }

        if (order.items.length === 0) {
          throw new AppError("Sales order has no items to dispatch", 400);
        }

        for (const item of order.items) {
          if (item.quantity <= 0) {
            throw new AppError(
              `Invalid order quantity for product ${item.product.productCode}`,
              400
            );
          }

          // Decrease physical and reserved together; only if both have enough stock.
          const updatedCount = await tx.$executeRaw`
            UPDATE "Inventory"
            SET
              "physicalQuantity" = "physicalQuantity" - ${item.quantity},
              "reservedQuantity" = "reservedQuantity" - ${item.quantity},
              "updatedAt" = CURRENT_TIMESTAMP
            WHERE "productId" = ${item.productId}
              AND "physicalQuantity" >= ${item.quantity}
              AND "reservedQuantity" >= ${item.quantity}
          `;

          if (updatedCount === 0) {
            const inventory = await tx.inventory.findUnique({
              where: { productId: item.productId },
            });

            throw new AppError(
              `Cannot dispatch product ${item.product.productCode}: insufficient physical/reserved stock (ordered ${item.quantity}, physical ${inventory?.physicalQuantity ?? 0}, reserved ${inventory?.reservedQuantity ?? 0})`,
              400
            );
          }
        }

        const dispatchNumber = await allocateDispatchNumber(tx);

        const dispatch = await tx.dispatch.create({
          data: {
            dispatchNumber,
            salesOrderId: order.id,
            dispatchDate: input.dispatchDate,
            vehicleNumber: input.vehicleNumber,
            driverName: input.driverName,
          },
          include: dispatchInclude,
        });

        await tx.salesOrder.update({
          where: { id: order.id },
          data: { status: SalesOrderStatus.DISPATCHED },
        });

        // Re-fetch with DISPATCHED status on nested sales order.
        return tx.dispatch.findUniqueOrThrow({
          where: { id: dispatch.id },
          include: dispatchInclude,
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 15000,
      }
    );

    return serializeDispatch(created);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError("Sales order already dispatched", 409);
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      throw new AppError(
        "Could not dispatch due to a concurrent update. Please retry.",
        409
      );
    }
    throw error;
  }
}

export async function listDispatches() {
  const rows = await prisma.dispatch.findMany({
    orderBy: { createdAt: "desc" },
    include: dispatchInclude,
  });
  return rows.map(serializeDispatch);
}

export async function getDispatchById(id: string) {
  const dispatch = await prisma.dispatch.findUnique({
    where: { id },
    include: dispatchInclude,
  });

  if (!dispatch) {
    throw new AppError("Dispatch not found", 404);
  }

  return serializeDispatch(dispatch);
}
