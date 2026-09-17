import { Prisma, QuotationStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../middleware/errorHandler";
import type { CreateQuotationInput } from "../validators/quotation.validator";
import { getProductsByIds } from "./product.service";

const quotationInclude = {
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
  enquiry: {
    select: {
      id: true,
      enquiryNumber: true,
      status: true,
      enquiryDate: true,
      requiredDate: true,
      notes: true,
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
  salesOrder: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
    },
  },
} as const;

const ALLOWED_STATUS_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  DRAFT: [QuotationStatus.SENT],
  SENT: [QuotationStatus.ACCEPTED, QuotationStatus.REJECTED],
  ACCEPTED: [],
  REJECTED: [],
};

export function calculateLineAmount(input: {
  quantity: number;
  unitPrice: Prisma.Decimal;
  discountPercent: Prisma.Decimal;
  gstPercent: Prisma.Decimal;
}): Prisma.Decimal {
  const quantity = new Prisma.Decimal(input.quantity);
  const baseAmount = quantity.mul(input.unitPrice);
  const discountAmount = baseAmount.mul(input.discountPercent).div(100);
  const taxableAmount = baseAmount.sub(discountAmount);
  const gstAmount = taxableAmount.mul(input.gstPercent).div(100);
  return taxableAmount.add(gstAmount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function serializeQuotation<
  T extends {
    grandTotal: Prisma.Decimal;
    items: Array<{
      unitPrice: Prisma.Decimal;
      discountPercent: Prisma.Decimal;
      gstPercent: Prisma.Decimal;
      lineAmount: Prisma.Decimal;
      product: { basePrice: Prisma.Decimal };
    }>;
  },
>(quotation: T) {
  return {
    ...quotation,
    grandTotal: quotation.grandTotal.toFixed(2),
    items: quotation.items.map((item) => ({
      ...item,
      unitPrice: item.unitPrice.toFixed(2),
      discountPercent: item.discountPercent.toFixed(2),
      gstPercent: item.gstPercent.toFixed(2),
      lineAmount: item.lineAmount.toFixed(2),
      product: {
        ...item.product,
        basePrice: item.product.basePrice.toFixed(2),
      },
    })),
  };
}

async function allocateQuotationNumber(
  tx: Prisma.TransactionClient
): Promise<string> {
  const quotations = await tx.quotation.findMany({
    select: { quotationNumber: true },
  });

  let max = 0;
  for (const row of quotations) {
    const match = row.quotationNumber.match(/^QUO-(\d+)$/);
    if (match) {
      max = Math.max(max, Number.parseInt(match[1], 10));
    }
  }

  return `QUO-${String(max + 1).padStart(6, "0")}`;
}

export async function createQuotation(input: CreateQuotationInput) {
  const enquiry = await prisma.enquiry.findUnique({
    where: { id: input.enquiryId },
    include: {
      items: { select: { id: true } },
    },
  });

  if (!enquiry) {
    throw new AppError("Enquiry not found", 404);
  }

  if (enquiry.items.length === 0) {
    throw new AppError("Enquiry has no items", 400);
  }

  const productIds = input.items.map((item) => item.productId);
  const products = await getProductsByIds(productIds);
  if (products.length !== productIds.length) {
    throw new AppError("One or more products were not found", 404);
  }

  const calculatedItems = input.items.map((item) => {
    const unitPrice = new Prisma.Decimal(item.unitPrice).toDecimalPlaces(2);
    const discountPercent = new Prisma.Decimal(item.discountPercent).toDecimalPlaces(2);
    const gstPercent = new Prisma.Decimal(item.gstPercent).toDecimalPlaces(2);
    const lineAmount = calculateLineAmount({
      quantity: item.quantity,
      unitPrice,
      discountPercent,
      gstPercent,
    });

    return {
      productId: item.productId,
      quantity: item.quantity,
      unitPrice,
      discountPercent,
      gstPercent,
      lineAmount,
    };
  });

  const grandTotal = calculatedItems
    .reduce((sum, item) => sum.add(item.lineAmount), new Prisma.Decimal(0))
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  try {
    const created = await prisma.$transaction(
      async (tx) => {
        const quotationNumber = await allocateQuotationNumber(tx);

        return tx.quotation.create({
          data: {
            quotationNumber,
            enquiryId: enquiry.id,
            customerId: enquiry.customerId,
            validUntil: input.validUntil,
            status: QuotationStatus.DRAFT,
            grandTotal,
            items: {
              create: calculatedItems,
            },
          },
          include: quotationInclude,
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    return serializeQuotation(created);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError("Quotation number conflict. Please retry.", 409);
    }
    throw error;
  }
}

export async function listQuotations() {
  const quotations = await prisma.quotation.findMany({
    orderBy: { createdAt: "desc" },
    include: quotationInclude,
  });

  return quotations.map(serializeQuotation);
}

export async function getQuotationById(id: string) {
  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: quotationInclude,
  });

  if (!quotation) {
    throw new AppError("Quotation not found", 404);
  }

  return serializeQuotation(quotation);
}

export async function updateQuotationStatus(
  id: string,
  nextStatus: QuotationStatus
) {
  const quotation = await prisma.quotation.findUnique({
    where: { id },
    select: { id: true, status: true },
  });

  if (!quotation) {
    throw new AppError("Quotation not found", 404);
  }

  const allowed = ALLOWED_STATUS_TRANSITIONS[quotation.status];
  if (!allowed.includes(nextStatus)) {
    throw new AppError(
      `Invalid status transition from ${quotation.status} to ${nextStatus}`,
      400
    );
  }

  const updated = await prisma.quotation.update({
    where: { id },
    data: { status: nextStatus },
    include: quotationInclude,
  });

  return serializeQuotation(updated);
}
