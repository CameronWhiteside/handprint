import { z } from 'zod';

export const signInputSchema = z.object({
  ts: z.string(),
  session: z.string().optional(),
  plaintext: z.string(),
});
export type SignInput = z.infer<typeof signInputSchema>;
