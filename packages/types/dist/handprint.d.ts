import { z } from 'zod';
export declare const HANDPRINT_TYPES: readonly ["vision", "choice", "method"];
export declare const VISION_SUBTYPES: readonly ["goal", "direction", "principle"];
export declare const CHOICE_SUBTYPES: readonly ["approval", "override", "rejection", "constraint", "inquiry"];
export declare const METHOD_SUBTYPES: readonly ["tool", "knowledge", "process"];
export declare const HANDPRINT_STATUSES: readonly ["open", "resolved"];
export declare const RESOLUTION_STATUSES: readonly ["validated", "partial", "revised", "invalidated"];
export declare const ALL_SUBTYPES: readonly ["goal", "direction", "principle", "approval", "override", "rejection", "constraint", "inquiry", "tool", "knowledge", "process"];
export declare const SUBTYPES_BY_TYPE: {
    readonly vision: readonly ["goal", "direction", "principle"];
    readonly choice: readonly ["approval", "override", "rejection", "constraint", "inquiry"];
    readonly method: readonly ["tool", "knowledge", "process"];
};
export declare const handprintTypeSchema: z.ZodEnum<["vision", "choice", "method"]>;
export type HandprintType = z.infer<typeof handprintTypeSchema>;
export declare const visionSubtypeSchema: z.ZodEnum<["goal", "direction", "principle"]>;
export type VisionSubtype = z.infer<typeof visionSubtypeSchema>;
export declare const choiceSubtypeSchema: z.ZodEnum<["approval", "override", "rejection", "constraint", "inquiry"]>;
export type ChoiceSubtype = z.infer<typeof choiceSubtypeSchema>;
export declare const methodSubtypeSchema: z.ZodEnum<["tool", "knowledge", "process"]>;
export type MethodSubtype = z.infer<typeof methodSubtypeSchema>;
export declare const allSubtypesSchema: z.ZodEnum<["goal", "direction", "principle", "approval", "override", "rejection", "constraint", "inquiry", "tool", "knowledge", "process"]>;
export type Subtype = z.infer<typeof allSubtypesSchema>;
export declare const handprintStatusSchema: z.ZodEnum<["open", "resolved"]>;
export type HandprintStatus = z.infer<typeof handprintStatusSchema>;
export declare const resolutionStatusSchema: z.ZodEnum<["validated", "partial", "revised", "invalidated"]>;
export type ResolutionStatus = z.infer<typeof resolutionStatusSchema>;
export declare function subtypeSchemaForType(type: HandprintType): z.ZodEnum<["goal", "direction", "principle"]> | z.ZodEnum<["approval", "override", "rejection", "constraint", "inquiry"]> | z.ZodEnum<["tool", "knowledge", "process"]>;
export declare const visionMarkSchema: z.ZodObject<{
    type: z.ZodLiteral<"vision">;
    subtype: z.ZodEnum<["goal", "direction", "principle"]>;
    note: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "vision";
    subtype: "goal" | "direction" | "principle";
    note: string;
}, {
    type: "vision";
    subtype: "goal" | "direction" | "principle";
    note: string;
}>;
export declare const choiceMarkSchema: z.ZodObject<{
    type: z.ZodLiteral<"choice">;
    subtype: z.ZodEnum<["approval", "override", "rejection", "constraint", "inquiry"]>;
    note: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "choice";
    subtype: "approval" | "override" | "rejection" | "constraint" | "inquiry";
    note: string;
}, {
    type: "choice";
    subtype: "approval" | "override" | "rejection" | "constraint" | "inquiry";
    note: string;
}>;
export declare const methodMarkSchema: z.ZodObject<{
    type: z.ZodLiteral<"method">;
    subtype: z.ZodEnum<["tool", "knowledge", "process"]>;
    note: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "method";
    subtype: "tool" | "knowledge" | "process";
    note: string;
}, {
    type: "method";
    subtype: "tool" | "knowledge" | "process";
    note: string;
}>;
export declare const markSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"vision">;
    subtype: z.ZodEnum<["goal", "direction", "principle"]>;
    note: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "vision";
    subtype: "goal" | "direction" | "principle";
    note: string;
}, {
    type: "vision";
    subtype: "goal" | "direction" | "principle";
    note: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"choice">;
    subtype: z.ZodEnum<["approval", "override", "rejection", "constraint", "inquiry"]>;
    note: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "choice";
    subtype: "approval" | "override" | "rejection" | "constraint" | "inquiry";
    note: string;
}, {
    type: "choice";
    subtype: "approval" | "override" | "rejection" | "constraint" | "inquiry";
    note: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"method">;
    subtype: z.ZodEnum<["tool", "knowledge", "process"]>;
    note: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "method";
    subtype: "tool" | "knowledge" | "process";
    note: string;
}, {
    type: "method";
    subtype: "tool" | "knowledge" | "process";
    note: string;
}>]>;
export type Mark = z.infer<typeof markSchema>;
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
    intent: z.ZodString;
    risk: z.ZodString;
    context: z.ZodString;
    marks: z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"vision">;
        subtype: z.ZodEnum<["goal", "direction", "principle"]>;
        note: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "vision";
        subtype: "goal" | "direction" | "principle";
        note: string;
    }, {
        type: "vision";
        subtype: "goal" | "direction" | "principle";
        note: string;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"choice">;
        subtype: z.ZodEnum<["approval", "override", "rejection", "constraint", "inquiry"]>;
        note: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "choice";
        subtype: "approval" | "override" | "rejection" | "constraint" | "inquiry";
        note: string;
    }, {
        type: "choice";
        subtype: "approval" | "override" | "rejection" | "constraint" | "inquiry";
        note: string;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"method">;
        subtype: z.ZodEnum<["tool", "knowledge", "process"]>;
        note: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "method";
        subtype: "tool" | "knowledge" | "process";
        note: string;
    }, {
        type: "method";
        subtype: "tool" | "knowledge" | "process";
        note: string;
    }>]>, "many">;
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
    status: "open" | "resolved";
    signature: string;
    madeAt: string;
    intent: string;
    risk: string;
    context: string;
    marks: ({
        type: "vision";
        subtype: "goal" | "direction" | "principle";
        note: string;
    } | {
        type: "choice";
        subtype: "approval" | "override" | "rejection" | "constraint" | "inquiry";
        note: string;
    } | {
        type: "method";
        subtype: "tool" | "knowledge" | "process";
        note: string;
    })[];
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
    project?: string | undefined;
    repo?: string | undefined;
    branch?: string | undefined;
    outcome?: string | undefined;
}, {
    status: "open" | "resolved";
    signature: string;
    madeAt: string;
    intent: string;
    risk: string;
    context: string;
    marks: ({
        type: "vision";
        subtype: "goal" | "direction" | "principle";
        note: string;
    } | {
        type: "choice";
        subtype: "approval" | "override" | "rejection" | "constraint" | "inquiry";
        note: string;
    } | {
        type: "method";
        subtype: "tool" | "knowledge" | "process";
        note: string;
    })[];
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
    project?: string | undefined;
    repo?: string | undefined;
    branch?: string | undefined;
    outcome?: string | undefined;
}>;
export type Handprint = z.infer<typeof handprintSchema>;
