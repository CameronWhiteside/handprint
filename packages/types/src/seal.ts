import { z } from 'zod';

export const sealSchema = z.object({
  v: z.number().int(),
  ts: z.string(),
  session: z.string(),
  project: z.string(),
  author: z.string(),
  parent: z.string().nullable(),
  payload: z.string(),
  signature: z.string(),
  pubkey: z.string(),
});
export type Seal = z.infer<typeof sealSchema>;

export const sealInputSchema = z.object({
  ts: z.string(),
  session: z.string(),
  project: z.string(),
  author: z.string(),
  plaintext: z.string(),
});
export type SealInput = z.infer<typeof sealInputSchema>;
