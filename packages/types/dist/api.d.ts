import { z } from 'zod';
export declare const pushProfileInputSchema: z.ZodObject<{
    handle: z.ZodString;
    profile: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    handle: string;
    profile: Record<string, unknown>;
    meta?: Record<string, unknown> | undefined;
}, {
    handle: string;
    profile: Record<string, unknown>;
    meta?: Record<string, unknown> | undefined;
}>;
export type PushProfileInput = z.infer<typeof pushProfileInputSchema>;
export declare const pushHandprintInputSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
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
    confidence: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    horizon: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    source: z.ZodOptional<z.ZodString>;
    status: z.ZodDefault<z.ZodEnum<["open", "resolved"]>>;
    outcome: z.ZodOptional<z.ZodString>;
    anchors: z.ZodDefault<z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        verified: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        label: string;
        verified: boolean;
    }, {
        label: string;
        verified: boolean;
    }>, "many">>;
    resolutions: z.ZodDefault<z.ZodArray<z.ZodObject<{
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
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    type: "vision";
    status: "open" | "resolved";
    signature: string;
    madeAt: string;
    intent: string;
    risk: string;
    context: string;
    anchors: {
        label: string;
        verified: boolean;
    }[];
    resolutions: {
        status: "validated" | "partial" | "revised" | "invalidated";
        body: string;
        timestamp: string;
    }[];
    subtype?: "goal" | "direction" | "principle" | undefined;
    project?: string | undefined;
    repo?: string | undefined;
    branch?: string | undefined;
    confidence?: number | null | undefined;
    horizon?: string | null | undefined;
    source?: string | undefined;
    outcome?: string | undefined;
}, {
    type: "vision";
    signature: string;
    madeAt: string;
    intent: string;
    risk: string;
    context: string;
    status?: "open" | "resolved" | undefined;
    subtype?: "goal" | "direction" | "principle" | undefined;
    project?: string | undefined;
    repo?: string | undefined;
    branch?: string | undefined;
    confidence?: number | null | undefined;
    horizon?: string | null | undefined;
    anchors?: {
        label: string;
        verified: boolean;
    }[] | undefined;
    source?: string | undefined;
    outcome?: string | undefined;
    resolutions?: {
        status: "validated" | "partial" | "revised" | "invalidated";
        body: string;
        timestamp: string;
    }[] | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"choice">;
    subtype: z.ZodOptional<z.ZodEnum<["approval", "override", "rejection", "constraint", "inquiry"]>>;
    signature: z.ZodString;
    madeAt: z.ZodString;
    intent: z.ZodString;
    risk: z.ZodString;
    context: z.ZodString;
    project: z.ZodOptional<z.ZodString>;
    repo: z.ZodOptional<z.ZodString>;
    branch: z.ZodOptional<z.ZodString>;
    confidence: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    horizon: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    source: z.ZodOptional<z.ZodString>;
    status: z.ZodDefault<z.ZodEnum<["open", "resolved"]>>;
    outcome: z.ZodOptional<z.ZodString>;
    anchors: z.ZodDefault<z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        verified: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        label: string;
        verified: boolean;
    }, {
        label: string;
        verified: boolean;
    }>, "many">>;
    resolutions: z.ZodDefault<z.ZodArray<z.ZodObject<{
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
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    type: "choice";
    status: "open" | "resolved";
    signature: string;
    madeAt: string;
    intent: string;
    risk: string;
    context: string;
    anchors: {
        label: string;
        verified: boolean;
    }[];
    resolutions: {
        status: "validated" | "partial" | "revised" | "invalidated";
        body: string;
        timestamp: string;
    }[];
    subtype?: "approval" | "override" | "rejection" | "constraint" | "inquiry" | undefined;
    project?: string | undefined;
    repo?: string | undefined;
    branch?: string | undefined;
    confidence?: number | null | undefined;
    horizon?: string | null | undefined;
    source?: string | undefined;
    outcome?: string | undefined;
}, {
    type: "choice";
    signature: string;
    madeAt: string;
    intent: string;
    risk: string;
    context: string;
    status?: "open" | "resolved" | undefined;
    subtype?: "approval" | "override" | "rejection" | "constraint" | "inquiry" | undefined;
    project?: string | undefined;
    repo?: string | undefined;
    branch?: string | undefined;
    confidence?: number | null | undefined;
    horizon?: string | null | undefined;
    anchors?: {
        label: string;
        verified: boolean;
    }[] | undefined;
    source?: string | undefined;
    outcome?: string | undefined;
    resolutions?: {
        status: "validated" | "partial" | "revised" | "invalidated";
        body: string;
        timestamp: string;
    }[] | undefined;
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
    confidence: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    horizon: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    source: z.ZodOptional<z.ZodString>;
    status: z.ZodDefault<z.ZodEnum<["open", "resolved"]>>;
    outcome: z.ZodOptional<z.ZodString>;
    anchors: z.ZodDefault<z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        verified: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        label: string;
        verified: boolean;
    }, {
        label: string;
        verified: boolean;
    }>, "many">>;
    resolutions: z.ZodDefault<z.ZodArray<z.ZodObject<{
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
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    type: "method";
    status: "open" | "resolved";
    signature: string;
    madeAt: string;
    intent: string;
    risk: string;
    context: string;
    anchors: {
        label: string;
        verified: boolean;
    }[];
    resolutions: {
        status: "validated" | "partial" | "revised" | "invalidated";
        body: string;
        timestamp: string;
    }[];
    subtype?: "tool" | "knowledge" | "process" | "delegation" | undefined;
    project?: string | undefined;
    repo?: string | undefined;
    branch?: string | undefined;
    confidence?: number | null | undefined;
    horizon?: string | null | undefined;
    source?: string | undefined;
    outcome?: string | undefined;
}, {
    type: "method";
    signature: string;
    madeAt: string;
    intent: string;
    risk: string;
    context: string;
    status?: "open" | "resolved" | undefined;
    subtype?: "tool" | "knowledge" | "process" | "delegation" | undefined;
    project?: string | undefined;
    repo?: string | undefined;
    branch?: string | undefined;
    confidence?: number | null | undefined;
    horizon?: string | null | undefined;
    anchors?: {
        label: string;
        verified: boolean;
    }[] | undefined;
    source?: string | undefined;
    outcome?: string | undefined;
    resolutions?: {
        status: "validated" | "partial" | "revised" | "invalidated";
        body: string;
        timestamp: string;
    }[] | undefined;
}>]>;
export type PushHandprintInput = z.infer<typeof pushHandprintInputSchema>;
export declare const handleParamSchema: z.ZodObject<{
    handle: z.ZodString;
}, "strip", z.ZodTypeAny, {
    handle: string;
}, {
    handle: string;
}>;
export type HandleParam = z.infer<typeof handleParamSchema>;
export declare const handprintsQuerySchema: z.ZodObject<{
    type: z.ZodOptional<z.ZodEnum<["vision", "choice", "method"]>>;
    subtype: z.ZodOptional<z.ZodEnum<["goal", "direction", "principle", "approval", "override", "rejection", "constraint", "inquiry", "tool", "knowledge", "process", "delegation"]>>;
    status: z.ZodOptional<z.ZodEnum<["open", "resolved"]>>;
    repo: z.ZodOptional<z.ZodString>;
    project: z.ZodOptional<z.ZodString>;
    source: z.ZodOptional<z.ZodString>;
    after: z.ZodOptional<z.ZodString>;
    before: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    sort: z.ZodDefault<z.ZodEnum<["madeAt", "-madeAt"]>>;
}, "strip", z.ZodTypeAny, {
    sort: "madeAt" | "-madeAt";
    limit: number;
    offset: number;
    type?: "vision" | "choice" | "method" | undefined;
    status?: "open" | "resolved" | undefined;
    subtype?: "goal" | "direction" | "principle" | "approval" | "override" | "rejection" | "constraint" | "inquiry" | "tool" | "knowledge" | "process" | "delegation" | undefined;
    project?: string | undefined;
    repo?: string | undefined;
    source?: string | undefined;
    after?: string | undefined;
    before?: string | undefined;
}, {
    sort?: "madeAt" | "-madeAt" | undefined;
    type?: "vision" | "choice" | "method" | undefined;
    status?: "open" | "resolved" | undefined;
    subtype?: "goal" | "direction" | "principle" | "approval" | "override" | "rejection" | "constraint" | "inquiry" | "tool" | "knowledge" | "process" | "delegation" | undefined;
    project?: string | undefined;
    repo?: string | undefined;
    source?: string | undefined;
    after?: string | undefined;
    before?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
}>;
export type HandprintsQuery = z.infer<typeof handprintsQuerySchema>;
export declare const heatmapQuerySchema: z.ZodObject<{
    weeks: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    weeks: number;
}, {
    weeks?: number | undefined;
}>;
export type HeatmapQuery = z.infer<typeof heatmapQuerySchema>;
export declare const reposQuerySchema: z.ZodObject<{
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
}, {
    limit?: number | undefined;
}>;
export type ReposQuery = z.infer<typeof reposQuerySchema>;
export declare const searchQuerySchema: z.ZodObject<{
    q: z.ZodString;
    type: z.ZodOptional<z.ZodEnum<["vision", "choice", "method"]>>;
    domain: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    offset: number;
    q: string;
    type?: "vision" | "choice" | "method" | undefined;
    domain?: string | undefined;
}, {
    q: string;
    type?: "vision" | "choice" | "method" | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
    domain?: string | undefined;
}>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export declare const deviceCodeResponseSchema: z.ZodObject<{
    status: z.ZodLiteral<200>;
    deviceCode: z.ZodString;
    userCode: z.ZodString;
    verificationUrl: z.ZodString;
    expiresIn: z.ZodNumber;
    interval: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: 200;
    deviceCode: string;
    userCode: string;
    verificationUrl: string;
    expiresIn: number;
    interval: number;
}, {
    status: 200;
    deviceCode: string;
    userCode: string;
    verificationUrl: string;
    expiresIn: number;
    interval: number;
}>;
export type DeviceCodeResponse = z.infer<typeof deviceCodeResponseSchema>;
export declare const deviceTokenRequestSchema: z.ZodObject<{
    device_code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    device_code: string;
}, {
    device_code: string;
}>;
export type DeviceTokenRequest = z.infer<typeof deviceTokenRequestSchema>;
export declare const deviceTokenResponseSchema: z.ZodObject<{
    status: z.ZodLiteral<200>;
    accessToken: z.ZodString;
    tokenType: z.ZodLiteral<"Bearer">;
    expiresIn: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: 200;
    expiresIn: number;
    accessToken: string;
    tokenType: "Bearer";
}, {
    status: 200;
    expiresIn: number;
    accessToken: string;
    tokenType: "Bearer";
}>;
export type DeviceTokenResponse = z.infer<typeof deviceTokenResponseSchema>;
export declare const apiErrorSchema: z.ZodObject<{
    status: z.ZodNumber;
    message: z.ZodString;
    detail: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    message: string;
    status: number;
    detail?: string | undefined;
}, {
    message: string;
    status: number;
    detail?: string | undefined;
}>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export declare const validationErrorSchema: z.ZodObject<{
    status: z.ZodLiteral<400>;
    message: z.ZodLiteral<"Validation Error">;
    issues: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    issues: Record<string, string[]>;
    message: "Validation Error";
    status: 400;
}, {
    issues: Record<string, string[]>;
    message: "Validation Error";
    status: 400;
}>;
export type ValidationError = z.infer<typeof validationErrorSchema>;
