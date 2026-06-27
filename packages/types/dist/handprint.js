import { z } from 'zod';
// ── Mark constants ───────────────────────────────────────────
export const HANDPRINT_TYPES = ['vision', 'choice', 'method'];
export const VISION_SUBTYPES = ['goal', 'direction', 'principle'];
export const CHOICE_SUBTYPES = ['approval', 'override', 'rejection', 'constraint', 'inquiry'];
export const METHOD_SUBTYPES = ['tool', 'knowledge', 'process'];
export const ALL_SUBTYPES = [
    ...VISION_SUBTYPES,
    ...CHOICE_SUBTYPES,
    ...METHOD_SUBTYPES,
];
export const SUBTYPES_BY_TYPE = {
    vision: VISION_SUBTYPES,
    choice: CHOICE_SUBTYPES,
    method: METHOD_SUBTYPES,
};
export const MARK_NOTE_MAX = 280;
// ── Artifact constants ───────────────────────────────────────
export const ARTIFACT_TYPES = [
    'git-commit',
    'git-repo',
    'file',
    'url',
    'deployment',
    'c2pa',
    'custom',
];
// ── Visibility constants ─────────────────────────────────────
export const VISIBILITY_LEVELS = ['private', 'unlisted', 'public'];
// ── Type schemas ─────────────────────────────────────────────
export const handprintTypeSchema = z.enum(HANDPRINT_TYPES);
export const visionSubtypeSchema = z.enum(VISION_SUBTYPES);
export const choiceSubtypeSchema = z.enum(CHOICE_SUBTYPES);
export const methodSubtypeSchema = z.enum(METHOD_SUBTYPES);
export const allSubtypesSchema = z.enum(ALL_SUBTYPES);
export const artifactTypeSchema = z.enum(ARTIFACT_TYPES);
export const visibilitySchema = z.enum(VISIBILITY_LEVELS);
export function subtypeSchemaForType(type) {
    const map = {
        vision: visionSubtypeSchema,
        choice: choiceSubtypeSchema,
        method: methodSubtypeSchema,
    };
    return map[type];
}
// ── Marks ────────────────────────────────────────────────────
export const visionMarkSchema = z.object({
    type: z.literal(HANDPRINT_TYPES[0]),
    subtype: visionSubtypeSchema,
    note: z.string().min(1).max(MARK_NOTE_MAX),
});
export const choiceMarkSchema = z.object({
    type: z.literal(HANDPRINT_TYPES[1]),
    subtype: choiceSubtypeSchema,
    note: z.string().min(1).max(MARK_NOTE_MAX),
});
export const methodMarkSchema = z.object({
    type: z.literal(HANDPRINT_TYPES[2]),
    subtype: methodSubtypeSchema,
    note: z.string().min(1).max(MARK_NOTE_MAX),
});
export const markSchema = z.discriminatedUnion('type', [
    visionMarkSchema,
    choiceMarkSchema,
    methodMarkSchema,
]);
// ── Artifacts ────────────────────────────────────────────────
export const artifactSchema = z.object({
    type: artifactTypeSchema,
    uri: z.string().min(1),
    hash: z.string().optional(),
    parent: z.string().optional(),
});
// ── Source ────────────────────────────────────────────────────
export const sourceSchema = z.object({
    agent: z.string().min(1),
    extractor: z.string().optional(),
    session: z.string().optional(),
});
// ── Handprint object (local, includes encrypted payload) ─────
export const HANDPRINT_OBJECT_VERSION = 1;
export const handprintObjectSchema = z.object({
    v: z.literal(HANDPRINT_OBJECT_VERSION),
    ts: z.string(),
    marks: z.array(markSchema).min(1),
    artifacts: z.array(artifactSchema).default([]),
    source: sourceSchema,
    payload: z.string().min(1),
    parent: z.string().nullable(),
    sig: z.string().min(1),
    pubkey: z.string().min(1),
});
// ── Public key registration (multi-device) ───────────────────
export const registeredKeySchema = z.object({
    pubkey: z.string().min(1),
    fingerprint: z.string().min(1),
    label: z.string().min(1).max(64),
    addedAt: z.string(),
});
//# sourceMappingURL=handprint.js.map