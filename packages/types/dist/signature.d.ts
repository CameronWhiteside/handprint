import { z } from 'zod';
export declare const signInputSchema: z.ZodObject<{
    ts: z.ZodString;
    session: z.ZodOptional<z.ZodString>;
    plaintext: z.ZodString;
}, "strip", z.ZodTypeAny, {
    ts: string;
    plaintext: string;
    session?: string | undefined;
}, {
    ts: string;
    plaintext: string;
    session?: string | undefined;
}>;
export type SignInput = z.infer<typeof signInputSchema>;
