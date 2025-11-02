import { z } from "zod";

export const insertDonationSchema = z.object({
  donor_name: z.string().min(1, "Donor name is required"),
  donor_email: z.string().email("Valid email required"),
  amount: z.number().positive("Amount must be positive"),
  message: z.string().optional(),
});
