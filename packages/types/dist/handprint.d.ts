import { z } from 'zod';
export declare const handprintTypeSchema: z.ZodEnum<["vision", "choice", "method"]>;
export type HandprintType = z.infer<typeof handprintTypeSchema>;
export declare const visionSubtypeSchema: z.ZodEnum<["goal", "direction", "principle"]>;
export type VisionSubtype = z.infer<typeof visionSubtypeSchema>;
export declare const choiceSubtypeSchema: z.ZodEnum<["approval", "override", "rejection", "constraint", "tradeoff", "inquiry"]>;
export type ChoiceSubtype = z.infer<typeof choiceSubtypeSchema>;
export declare const methodSubtypeSchema: z.ZodEnum<["tool", "knowledge", "process", "delegation"]>;
export type MethodSubtype = z.infer<typeof methodSubtypeSchema>;
export declare const subtypesByType: {
    readonly vision: z.ZodEnum<["goal", "direction", "principle"]>;
    readonly choice: z.ZodEnum<["approval", "override", "rejection", "constraint", "tradeoff", "inquiry"]>;
    readonly method: z.ZodEnum<["tool", "knowledge", "process", "delegation"]>;
};
export declare const allSubtypesSchema: z.ZodEnum<["goal", "direction", "principle", "approval", "override", "rejection", "constraint", "tradeoff", "inquiry", "tool", "knowledge", "process", "delegation"]>;
export type Subtype = z.infer<typeof allSubtypesSchema>;
export declare function subtypeSchemaForType(type: HandprintType): z.ZodEnum<["goal", "direction", "principle"]> | z.ZodEnum<["approval", "override", "rejection", "constraint", "tradeoff", "inquiry"]> | z.ZodEnum<["tool", "knowledge", "process", "delegation"]>;
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
export declare const visionHandprintSchema: z.ZodObject<{
    type: z.ZodLiteral<"vision">;
    subtype: z.ZodOptional<z.ZodEnum<["goal", "direction", "principle"]>>;
    signature: z.ZodString;
    madeAt: z.ZodString;
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
    type: "vision";
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
    subtype?: "goal" | "direction" | "principle" | undefined;
    project?: string | undefined;
    repo?: string | undefined;
    branch?: string | undefined;
    outcome?: string | undefined;
}, {
    type: "vision";
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
    subtype?: "goal" | "direction" | "principle" | undefined;
    project?: string | undefined;
    repo?: string | undefined;
    branch?: string | undefined;
    outcome?: string | undefined;
}>;
export declare const choiceHandprintSchema: z.ZodObject<{
    type: z.ZodLiteral<"choice">;
    subtype: z.ZodOptional<z.ZodEnum<["approval", "override", "rejection", "constraint", "tradeoff", "inquiry"]>>;
    signature: z.ZodString;
    madeAt: z.ZodString;
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
    type: "choice";
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
    subtype?: "approval" | "override" | "rejection" | "constraint" | "tradeoff" | "inquiry" | undefined;
    project?: string | undefined;
    repo?: string | undefined;
    branch?: string | undefined;
    outcome?: string | undefined;
}, {
    type: "choice";
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
    subtype?: "approval" | "override" | "rejection" | "constraint" | "tradeoff" | "inquiry" | undefined;
    project?: string | undefined;
    repo?: string | undefined;
    branch?: string | undefined;
    outcome?: string | undefined;
}>;
export declare const methodHandprintSchema: z.ZodObject<{
    type: z.ZodLiteral<"method">;
    subtype: z.ZodOptional<z.ZodEnum<["tool", "knowledge", "process", "delegation"]>>;
    signature: z.ZodString;
    madeAt: z.ZodString;
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
    type: "method";
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
    subtype?: "tool" | "knowledge" | "process" | "delegation" | undefined;
    project?: string | undefined;
    repo?: string | undefined;
    branch?: string | undefined;
    outcome?: string | undefined;
}, {
    type: "method";
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
    subtype?: "tool" | "knowledge" | "process" | "delegation" | undefined;
    project?: string | undefined;
    repo?: string | undefined;
    branch?: string | undefined;
    outcome?: string | undefined;
}>;
export declare const handprintSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"vision">;
    subtype: z.ZodOptional<z.ZodEnum<["goal", "direction", "principle"]>>;
    signature: z.ZodString;
    madeAt: z.ZodString;
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
    type: "vision";
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
    subtype?: "goal" | "direction" | "principle" | undefined;
    project?: string | undefined;
    repo?: string | undefined;
    branch?: string | undefined;
    outcome?: string | undefined;
}, {
    type: "vision";
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
    subtype?: "goal" | "direction" | "principle" | undefined;
    project?: string | undefined;
    repo?: string | undefined;
    branch?: string | undefined;
    outcome?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"choice">;
    subtype: z.ZodOptional<z.ZodEnum<["approval", "override", "rejection", "constraint", "tradeoff", "inquiry"]>>;
    signature: z.ZodString;
    madeAt: z.ZodString;
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
    type: "choice";
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
    subtype?: "approval" | "override" | "rejection" | "constraint" | "tradeoff" | "inquiry" | undefined;
    project?: string | undefined;
    repo?: string | undefined;
    branch?: string | undefined;
    outcome?: string | undefined;
}, {
    type: "choice";
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
    subtype?: "approval" | "override" | "rejection" | "constraint" | "tradeoff" | "inquiry" | undefined;
    project?: string | undefined;
    repo?: string | undefined;
    branch?: string | undefined;
    outcome?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"method">;
    subtype: z.ZodOptional<z.ZodEnum<["tool", "knowledge", "process", "delegation"]>>;
    signature: z.ZodString;
    madeAt: z.ZodString;
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
    type: "method";
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
    subtype?: "tool" | "knowledge" | "process" | "delegation" | undefined;
    project?: string | undefined;
    repo?: string | undefined;
    branch?: string | undefined;
    outcome?: string | undefined;
}, {
    type: "method";
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
    subtype?: "tool" | "knowledge" | "process" | "delegation" | undefined;
    project?: string | undefined;
    repo?: string | undefined;
    branch?: string | undefined;
    outcome?: string | undefined;
}>]>;
export type Handprint = z.infer<typeof handprintSchema>;
