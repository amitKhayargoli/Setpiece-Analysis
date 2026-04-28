import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(4000),
  WYSCOUT_DATA_DIR: z.string().min(1).default("D:\\sem 6\\wyscout_pl\\Data"),
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  PORT: process.env.PORT,
  WYSCOUT_DATA_DIR: process.env.WYSCOUT_DATA_DIR,
});
