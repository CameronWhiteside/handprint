import { z } from 'zod';
export declare const signatureSchema: z.ZodObject<{
    v: z.ZodNumber;
    ts: z.ZodString;
    session: z.ZodString;
    project: z.ZodString;
    author: z.ZodString;
    parent: z.ZodNullable<z.ZodString>;
    payload: z.ZodString;
    sig: z.ZodString;
    pubkey: z.ZodString;
}, "strip", z.ZodTypeAny, {
    project: string;
    v: number;
    ts: string;
    session: string;
    author: string;
    parent: string | null;
    payload: string;
    sig: string;
    pubkey: string;
}, {
    project: string;
    v: number;
    ts: string;
    session: string;
    author: string;
    parent: string | null;
    payload: string;
    sig: string;
    pubkey: string;
}>;
export type Signature = z.infer<typeof signatureSchema>;
export declare const signInputSchema: z.ZodObject<{
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
export type SignInput = z.infer<typeof signInputSchema>;
