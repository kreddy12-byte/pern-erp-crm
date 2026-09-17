import { z } from "zod";

const enquiryItemSchema = z.object({
  productId: z.string().trim().min(1, "Product is required"),
  quantity: z.coerce
    .number({ invalid_type_error: "Quantity must be a number" })
    .int("Quantity must be an integer")
    .positive("Quantity must be greater than zero"),
});

export const createEnquirySchema = z
  .object({
    customerId: z.string().trim().min(1, "Customer is required"),
    enquiryDate: z.coerce.date({ invalid_type_error: "Enquiry date is required" }),
    requiredDate: z.coerce.date({ invalid_type_error: "Required date is required" }),
    notes: z.string().trim().optional(),
    items: z
      .array(enquiryItemSchema)
      .min(1, "At least one enquiry item is required"),
  })
  .superRefine((data, ctx) => {
    if (data.requiredDate < data.enquiryDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Required date cannot be before enquiry date",
        path: ["requiredDate"],
      });
    }

    const productIds = data.items.map((item) => item.productId);
    const uniqueIds = new Set(productIds);
    if (uniqueIds.size !== productIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate products are not allowed in the same enquiry",
        path: ["items"],
      });
    }
  });

export type CreateEnquiryInput = z.infer<typeof createEnquirySchema>;
