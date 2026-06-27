import { z } from 'zod';
export declare const handprintTypeSchema: z.ZodEnum<["vision", "choice", "method"]>;
export type HandprintType = z.infer<typeof handprintTypeSchema>;
export declare const handprintStatusSchema: z.ZodEnum<["open", "resolved"]>;
export type HandprintStatus = z.infer<typeof handprintStatusSchema>;
export declare const resolutionStatusSchema: z.ZodEnum<["validated", "partial", "revised", "invalidated"]>;
export type ResolutionStatus = z.infer<typeof resolutionStatusSchema>;
export declare const anchorSchema: z.ZodObject<{
    label: z.ZodString;
    verified: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    label: string;
    verified: boolean;
}, {
    label: string;
    verified: boolean;
}>;
export type Anchor = z.infer<typeof anchorSchema>;
export declare const resolutionSchema: z.ZodObject<{
    status: z.ZodEnum<["validated", "partial", "revised", "invalidated"]>;
    body: z.ZodString;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "validated" | "partial" | "revised" | "invalidated";
    body: string;
    timestamp: string;
}, {
    status: "validated" | "partial" | "revised" | "invalidated";
    body: string;
    timestamp: string;
}>;
export type Resolution = z.infer<typeof resolutionSchema>;
export declare const handprintSchema: z.ZodObject<{
    signature: z.ZodString;
    madeAt: z.ZodString;
    type: z.ZodEnum<["vision", "choice", "method"]>;
    subtype: z.ZodOptional<z.ZodString>;
    intent: z.ZodString;
    risk: z.ZodString;
    context: z.ZodString;
    project: z.ZodOptional<z.ZodString>;
    repo: z.ZodOptional<z.ZodString>;
    branch: z.ZodOptional<z.ZodString>;
    confidence: z.ZodNullable<z.ZodNumber>;
    horizon: z.ZodNullable<z.ZodString>;
    anchors: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        verified: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        label: string;
        verified: boolean;
    }, {
        label: string;
        verified: boolean;
    }>, "many">;
    source: z.ZodString;
    status: z.ZodEnum<["open", "resolved"]>;
    outcome: z.ZodOptional<z.ZodString>;
    resolutions: z.ZodArray<z.ZodObject<{
        status: z.ZodEnum<["validated", "partial", "revised", "invalidated"]>;
        body: z.ZodString;
        timestamp: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "validated" | "partial" | "revised" | "invalidated";
        body: string;
        timestamp: string;
    }, {
        status: "validated" | "partial" | "revised" | "invalidated";
        body: string;
        timestamp: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "vision" | "choice" | "method";
    status: "open" | "resolved";
    signature: string;
    madeAt: string;
    intent: string;
    risk: string;
    context: string;
    confidence: number | null;
    horizon: string | null;
    anchors: {
        label: string;
        verified: boolean;
    }[];
    source: string;
    resolutions: {
        status: "validated" | "partial" | "revised" | "invalidated";
        body: string;
        timestamp: string;
    }[];
    subtype?: string | undefined;
    project?: string | undefined;
    repo?: string | undefined;
    branch?: string | undefined;
    outcome?: string | undefined;
}, {
    type: "vision" | "choice" | "method";
    status: "open" | "resolved";
    signature: string;
    madeAt: string;
    intent: string;
    risk: string;
    context: string;
    confidence: number | null;
    horizon: string | null;
    anchors: {
        label: string;
        verified: boolean;
    }[];
    source: string;
    resolutions: {
        status: "validated" | "partial" | "revised" | "invalidated";
        body: string;
        timestamp: string;
    }[];
    subtype?: string | undefined;
    project?: string | undefined;
    repo?: string | undefined;
    branch?: string | undefined;
    outcome?: string | undefined;
}>;
export type Handprint = z.infer<typeof handprintSchema>;
