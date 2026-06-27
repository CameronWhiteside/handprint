import { z } from 'zod';
export declare const sealSchema: z.ZodObject<{
    v: z.ZodNumber;
    ts: z.ZodString;
    session: z.ZodString;
    project: z.ZodString;
    author: z.ZodString;
    parent: z.ZodNullable<z.ZodString>;
    payload: z.ZodString;
    signature: z.ZodString;
    pubkey: z.ZodString;
}, "strip", z.ZodTypeAny, {
    project: string;
    v: number;
    ts: string;
    session: string;
    author: string;
    parent: string | null;
    payload: string;
    signature: string;
    pubkey: string;
}, {
    project: string;
    v: number;
    ts: string;
    session: string;
    author: string;
    parent: string | null;
    payload: string;
    signature: string;
    pubkey: string;
}>;
export type Seal = z.infer<typeof sealSchema>;
export declare const sealInputSchema: z.ZodObject<{
    ts: z.ZodString;
    session: z.ZodString;
    project: z.ZodString;
    author: z.ZodString;
    plaintext: z.ZodString;
}, "strip", z.ZodTypeAny, {
    project: string;
    ts: string;
    session: string;
    author: string;
    plaintext: string;
}, {
    project: string;
    ts: string;
    session: string;
    author: string;
    plaintext: string;
}>;
export type SealInput = z.infer<typeof sealInputSchema>;
