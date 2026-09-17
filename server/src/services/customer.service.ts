import { prisma } from "../config/prisma";
import type { CreateCustomerInput } from "../validators/customer.validator";

const customerSelect = {
  id: true,
  companyName: true,
  contactPerson: true,
  mobile: true,
  email: true,
  city: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function createCustomer(input: CreateCustomerInput) {
  return prisma.customer.create({
    data: {
      companyName: input.companyName,
      contactPerson: input.contactPerson,
      mobile: input.mobile,
      email: input.email.toLowerCase(),
      city: input.city,
    },
    select: customerSelect,
  });
}

export async function listCustomers() {
  return prisma.customer.findMany({
    orderBy: { companyName: "asc" },
    select: customerSelect,
  });
}

export async function getCustomerById(id: string) {
  return prisma.customer.findUnique({
    where: { id },
    select: customerSelect,
  });
}
