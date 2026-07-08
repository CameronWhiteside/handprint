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
export declare const pushHandprintInputSchema: z.ZodObject<{
    v: z.ZodLiteral<1>;
    ts: z.ZodString;
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
    artifacts: z.ZodDefault<z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["git-commit", "git-repo", "file", "url", "deployment", "c2pa", "custom"]>;
        uri: z.ZodEffects<z.ZodString, string, string>;
        hash: z.ZodOptional<z.ZodString>;
        parent: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "git-commit" | "git-repo" | "file" | "url" | "deployment" | "c2pa" | "custom";
        uri: string;
        hash?: string | undefined;
        parent?: string | undefined;
    }, {
        type: "git-commit" | "git-repo" | "file" | "url" | "deployment" | "c2pa" | "custom";
        uri: string;
        hash?: string | undefined;
        parent?: string | undefined;
    }>, "many">>;
    source: z.ZodObject<{
        agent: z.ZodString;
        extractor: z.ZodOptional<z.ZodString>;
        session: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        agent: string;
        extractor?: string | undefined;
        session?: string | undefined;
    }, {
        agent: string;
        extractor?: string | undefined;
        session?: string | undefined;
    }>;
    parent: z.ZodNullable<z.ZodString>;
    sig: z.ZodString;
    pubkey: z.ZodString;
}, "strip", z.ZodTypeAny, {
    parent: string | null;
    v: 1;
    ts: string;
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
    artifacts: {
        type: "git-commit" | "git-repo" | "file" | "url" | "deployment" | "c2pa" | "custom";
        uri: string;
        hash?: string | undefined;
        parent?: string | undefined;
    }[];
    source: {
        agent: string;
        extractor?: string | undefined;
        session?: string | undefined;
    };
    sig: string;
    pubkey: string;
}, {
    parent: string | null;
    v: 1;
    ts: string;
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
    source: {
        agent: string;
        extractor?: string | undefined;
        session?: string | undefined;
    };
    sig: string;
    pubkey: string;
    artifacts?: {
        type: "git-commit" | "git-repo" | "file" | "url" | "deployment" | "c2pa" | "custom";
        uri: string;
        hash?: string | undefined;
        parent?: string | undefined;
    }[] | undefined;
}>;
export type PushHandprintInput = z.infer<typeof pushHandprintInputSchema>;
export declare const PUSH_HANDPRINTS_MAX: 500;
export declare const pushHandprintsInputSchema: z.ZodObject<{
    handprints: z.ZodArray<z.ZodObject<{
        v: z.ZodLiteral<1>;
        ts: z.ZodString;
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
        artifacts: z.ZodDefault<z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<["git-commit", "git-repo", "file", "url", "deployment", "c2pa", "custom"]>;
            uri: z.ZodEffects<z.ZodString, string, string>;
            hash: z.ZodOptional<z.ZodString>;
            parent: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "git-commit" | "git-repo" | "file" | "url" | "deployment" | "c2pa" | "custom";
            uri: string;
            hash?: string | undefined;
            parent?: string | undefined;
        }, {
            type: "git-commit" | "git-repo" | "file" | "url" | "deployment" | "c2pa" | "custom";
            uri: string;
            hash?: string | undefined;
            parent?: string | undefined;
        }>, "many">>;
        source: z.ZodObject<{
            agent: z.ZodString;
            extractor: z.ZodOptional<z.ZodString>;
            session: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            agent: string;
            extractor?: string | undefined;
            session?: string | undefined;
        }, {
            agent: string;
            extractor?: string | undefined;
            session?: string | undefined;
        }>;
        parent: z.ZodNullable<z.ZodString>;
        sig: z.ZodString;
        pubkey: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        parent: string | null;
        v: 1;
        ts: string;
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
        artifacts: {
            type: "git-commit" | "git-repo" | "file" | "url" | "deployment" | "c2pa" | "custom";
            uri: string;
            hash?: string | undefined;
            parent?: string | undefined;
        }[];
        source: {
            agent: string;
            extractor?: string | undefined;
            session?: string | undefined;
        };
        sig: string;
        pubkey: string;
    }, {
        parent: string | null;
        v: 1;
        ts: string;
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
        source: {
            agent: string;
            extractor?: string | undefined;
            session?: string | undefined;
        };
        sig: string;
        pubkey: string;
        artifacts?: {
            type: "git-commit" | "git-repo" | "file" | "url" | "deployment" | "c2pa" | "custom";
            uri: string;
            hash?: string | undefined;
            parent?: string | undefined;
        }[] | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    handprints: {
        parent: string | null;
        v: 1;
        ts: string;
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
        artifacts: {
            type: "git-commit" | "git-repo" | "file" | "url" | "deployment" | "c2pa" | "custom";
            uri: string;
            hash?: string | undefined;
            parent?: string | undefined;
        }[];
        source: {
            agent: string;
            extractor?: string | undefined;
            session?: string | undefined;
        };
        sig: string;
        pubkey: string;
    }[];
}, {
    handprints: {
        parent: string | null;
        v: 1;
        ts: string;
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
        source: {
            agent: string;
            extractor?: string | undefined;
            session?: string | undefined;
        };
        sig: string;
        pubkey: string;
        artifacts?: {
            type: "git-commit" | "git-repo" | "file" | "url" | "deployment" | "c2pa" | "custom";
            uri: string;
            hash?: string | undefined;
            parent?: string | undefined;
        }[] | undefined;
    }[];
}>;
export type PushHandprintsInput = z.infer<typeof pushHandprintsInputSchema>;
export declare const registerKeyInputSchema: z.ZodObject<{
    pubkey: z.ZodString;
    label: z.ZodString;
}, "strip", z.ZodTypeAny, {
    pubkey: string;
    label: string;
}, {
    pubkey: string;
    label: string;
}>;
export type RegisterKeyInput = z.infer<typeof registerKeyInputSchema>;
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
    subtype: z.ZodOptional<z.ZodEnum<["goal", "direction", "principle", "approval", "override", "rejection", "constraint", "inquiry", "tool", "knowledge", "process"]>>;
    agent: z.ZodOptional<z.ZodString>;
    after: z.ZodOptional<z.ZodString>;
    before: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
    sort: z.ZodDefault<z.ZodEnum<["ts", "-ts"]>>;
}, "strip", z.ZodTypeAny, {
    sort: "ts" | "-ts";
    limit: number;
    offset: number;
    type?: "vision" | "choice" | "method" | undefined;
    subtype?: "goal" | "direction" | "principle" | "approval" | "override" | "rejection" | "constraint" | "inquiry" | "tool" | "knowledge" | "process" | undefined;
    agent?: string | undefined;
    after?: string | undefined;
    before?: string | undefined;
}, {
    sort?: "ts" | "-ts" | undefined;
    type?: "vision" | "choice" | "method" | undefined;
    subtype?: "goal" | "direction" | "principle" | "approval" | "override" | "rejection" | "constraint" | "inquiry" | "tool" | "knowledge" | "process" | undefined;
    agent?: string | undefined;
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
export declare const searchQuerySchema: z.ZodObject<{
    q: z.ZodString;
    type: z.ZodOptional<z.ZodEnum<["vision", "choice", "method"]>>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    offset: number;
    q: string;
    type?: "vision" | "choice" | "method" | undefined;
}, {
    q: string;
    type?: "vision" | "choice" | "method" | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
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
