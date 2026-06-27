import { z } from 'zod';
export declare const HANDPRINT_TYPES: readonly ["vision", "choice", "method"];
export declare const VISION_SUBTYPES: readonly ["goal", "direction", "principle"];
export declare const CHOICE_SUBTYPES: readonly ["approval", "override", "rejection", "constraint", "inquiry"];
export declare const METHOD_SUBTYPES: readonly ["tool", "knowledge", "process"];
export declare const ALL_SUBTYPES: readonly ["goal", "direction", "principle", "approval", "override", "rejection", "constraint", "inquiry", "tool", "knowledge", "process"];
export declare const SUBTYPES_BY_TYPE: {
    readonly vision: readonly ["goal", "direction", "principle"];
    readonly choice: readonly ["approval", "override", "rejection", "constraint", "inquiry"];
    readonly method: readonly ["tool", "knowledge", "process"];
};
export declare const MARK_NOTE_MAX: 280;
export declare const ARTIFACT_TYPES: readonly ["git-commit", "git-repo", "file", "url", "deployment", "c2pa", "custom"];
export declare const VISIBILITY_LEVELS: readonly ["private", "unlisted", "public"];
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
export declare const artifactTypeSchema: z.ZodEnum<["git-commit", "git-repo", "file", "url", "deployment", "c2pa", "custom"]>;
export type ArtifactType = z.infer<typeof artifactTypeSchema>;
export declare const visibilitySchema: z.ZodEnum<["private", "unlisted", "public"]>;
export type Visibility = z.infer<typeof visibilitySchema>;
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
export declare const artifactSchema: z.ZodObject<{
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
}>;
export type Artifact = z.infer<typeof artifactSchema>;
export declare const sourceSchema: z.ZodObject<{
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
export type Source = z.infer<typeof sourceSchema>;
export declare const HANDPRINT_OBJECT_VERSION: 1;
export declare const handprintObjectSchema: z.ZodObject<{
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
    payload: z.ZodString;
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
    payload: string;
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
    payload: string;
    sig: string;
    pubkey: string;
    artifacts?: {
        type: "git-commit" | "git-repo" | "file" | "url" | "deployment" | "c2pa" | "custom";
        uri: string;
        hash?: string | undefined;
        parent?: string | undefined;
    }[] | undefined;
}>;
export type HandprintObject = z.infer<typeof handprintObjectSchema>;
export declare const registeredKeySchema: z.ZodObject<{
    pubkey: z.ZodString;
    fingerprint: z.ZodString;
    label: z.ZodString;
    addedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    pubkey: string;
    fingerprint: string;
    label: string;
    addedAt: string;
}, {
    pubkey: string;
    fingerprint: string;
    label: string;
    addedAt: string;
}>;
export type RegisteredKey = z.infer<typeof registeredKeySchema>;
