import { z } from "zod";

export const createDispatchSchema = z.object({
  dispatchDate: z.coerce.date({ invalid_type_error: "Dispatch date is required" }),
  vehicleNumber: z.string().trim().min(1, "Vehicle number is required"),
  driverName: z.string().trim().min(1, "Driver name is required"),
});

export type CreateDispatchInput = z.infer<typeof createDispatchSchema>;
