import { z } from "zod";

export const envSchema = z.object({
  EXPO_PUBLIC_API_URL: z.string(),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse({
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
});
