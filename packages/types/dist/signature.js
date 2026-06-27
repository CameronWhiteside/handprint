import { z } from 'zod';
export const signatureSchema = z.object({
    v: z.number().int(),
    ts: z.string(),
    session: z.string(),
    project: z.string(),
    author: z.string(),
    parent: z.string().nullable(),
    payload: z.string(),
    sig: z.string(),
    pubkey: z.string(),
});
export const signInputSchema = z.object({
    ts: z.string(),
    session: z.string(),
    project: z.string(),
    author: z.string(),
    plaintext: z.string(),
});
//# sourceMappingURL=signature.js.map