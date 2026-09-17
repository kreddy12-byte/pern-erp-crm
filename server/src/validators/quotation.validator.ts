import { z } from "zod";
import { QuotationStatus } from "@prisma/client";

const moneySchema = z.coerce
  .number({ invalid_type_error: "Amount must be a number" })
  .finite("Amount must be a valid number");

const quotationItemSchema = z.object({
  productId: z.string().trim().min(1, "Product is required"),
  quantity: z.coerce
    .number({ invalid_type_error: "Quantity must be a number" })
    .int("Quantity must be an integer")
    .positive("Quantity must be greater than zero"),
  unitPrice: moneySchema.nonnegative("Unit price cannot be negative"),
  discountPercent: moneySchema
    .min(0, "Discount cannot be negative")
    .max(100, "Discount cannot exceed 100"),
  gstPercent: moneySchema.min(0, "GST cannot be negative"),
});

export const createQuotationSchema = z
  .object({
    enquiryId: z.string().trim().min(1, "Enquiry is required"),
    validUntil: z.coerce.date({ invalid_type_error: "Valid until date is required" }),
    items: z
      .array(quotationItemSchema)
      .min(1, "At least one quotation item is required"),
  })
  .superRefine((data, ctx) => {
    const productIds = data.items.map((item) => item.productId);
    if (new Set(productIds).size !== productIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate products are not allowed in the same quotation",
        path: ["items"],
      });
    }
  });

export const updateQuotationStatusSchema = z.object({
  status: z.nativeEnum(QuotationStatus, {
    errorMap: () => ({ message: "Invalid quotation status" }),
  }),
});

export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;
export type UpdateQuotationStatusInput = z.infer<typeof updateQuotationStatusSchema>;
