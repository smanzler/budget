import { z } from "zod";

export const errorResponseSchema = z.object({
  message: z.string(),
});

export type Error = z.infer<typeof errorResponseSchema>;
