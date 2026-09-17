import { z } from "zod";

export const createCustomerSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required"),
  contactPerson: z.string().trim().min(1, "Contact person is required"),
  mobile: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{8,15}$/, "Mobile must be 8–15 digits (spaces/dashes/+ allowed)"),
  email: z.string().trim().email("Valid email is required"),
  city: z.string().trim().min(1, "City is required"),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
