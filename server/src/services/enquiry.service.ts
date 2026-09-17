import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../middleware/errorHandler";
import type { CreateEnquiryInput } from "../validators/enquiry.validator";
import { getCustomerById } from "./customer.service";
import { getProductsByIds } from "./product.service";

const enquiryInclude = {
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
} as const;

function serializeEnquiry<T extends { items: Array<{ product: { basePrice: Prisma.Decimal } }> }>(
  enquiry: T
) {
  return {
    ...enquiry,
    items: enquiry.items.map((item) => ({
      ...item,
      product: {
        ...item.product,
        basePrice: item.product.basePrice.toString(),
      },
    })),
  };
}

async function allocateEnquiryNumber(
  tx: Prisma.TransactionClient
): Promise<string> {
  const enquiries = await tx.enquiry.findMany({
    select: { enquiryNumber: true },
  });

  let max = 0;
  for (const row of enquiries) {
    const match = row.enquiryNumber.match(/^ENQ-(\d+)$/);
    if (match) {
      max = Math.max(max, Number.parseInt(match[1], 10));
    }
  }

  return `ENQ-${String(max + 1).padStart(6, "0")}`;
}

export async function createEnquiry(input: CreateEnquiryInput) {
  const customer = await getCustomerById(input.customerId);
  if (!customer) {
    throw new AppError("Customer not found", 404);
  }

  const productIds = input.items.map((item) => item.productId);
  const products = await getProductsByIds(productIds);
  if (products.length !== productIds.length) {
    throw new AppError("One or more products were not found", 404);
  }

  const notes = input.notes?.trim() ? input.notes.trim() : null;

  try {
    const created = await prisma.$transaction(
      async (tx) => {
        const enquiryNumber = await allocateEnquiryNumber(tx);

        return tx.enquiry.create({
          data: {
            enquiryNumber,
            customerId: input.customerId,
            enquiryDate: input.enquiryDate,
            requiredDate: input.requiredDate,
            notes,
            status: "NEW",
            items: {
              create: input.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
              })),
            },
          },
          include: enquiryInclude,
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    return serializeEnquiry(created);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError("Enquiry number conflict. Please retry.", 409);
    }
    throw error;
  }
}

export async function listEnquiries() {
  const enquiries = await prisma.enquiry.findMany({
    orderBy: { createdAt: "desc" },
    include: enquiryInclude,
  });

  return enquiries.map(serializeEnquiry);
}

export async function getEnquiryById(id: string) {
  const enquiry = await prisma.enquiry.findUnique({
    where: { id },
    include: enquiryInclude,
  });

  if (!enquiry) {
    throw new AppError("Enquiry not found", 404);
  }

  return serializeEnquiry(enquiry);
}
