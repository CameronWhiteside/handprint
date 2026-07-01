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
/**
 * The taxonomy of human influence, as a single source of truth consumed by the
 * extraction prompt (as a glossary) and by handprint-web (as subtype
 * definitions). vision = intent (why), choice = decision (what), method =
 * know-how (how). Keys MUST match HANDPRINT_TYPES and SUBTYPES_BY_TYPE; a test
 * enforces full coverage.
 */
export const TAXONOMY = {
    vision: {
        definition: "The human's intent: what they want to be true.",
        subtypes: {
            goal: 'A concrete outcome the human is aiming for.',
            direction: 'The heading the human sets; where the work should trend.',
            principle: 'A durable value the human holds that governs their choices.',
        },
    },
    choice: {
        definition: 'A fork the human resolved: a decision that shaped the work.',
        subtypes: {
            approval: 'The human endorsed a specific path or artifact.',
            override: 'The human chose one option over an alternative.',
            rejection: 'The human ruled something out.',
            constraint: 'The human imposed a hard rule or limit that bounds the work.',
            inquiry: 'A pointed question from the human that redirected the work.',
        },
    },
    method: {
        definition: 'The know-how the human brought: how the work got done.',
        subtypes: {
            tool: 'A named tool, technology, service, or category the human chose.',
            knowledge: "A fact or principle from the human's experience.",
            process: 'A technique or way of working the human applied.',
        },
    },
};
export const MARK_NOTE_MAX = 48;
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
// ── Type schemas ─────────────────────────────────────────────
export const handprintTypeSchema = z.enum(HANDPRINT_TYPES);
export const visionSubtypeSchema = z.enum(VISION_SUBTYPES);
export const choiceSubtypeSchema = z.enum(CHOICE_SUBTYPES);
export const methodSubtypeSchema = z.enum(METHOD_SUBTYPES);
export const allSubtypesSchema = z.enum(ALL_SUBTYPES);
export const artifactTypeSchema = z.enum(ARTIFACT_TYPES);
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
const ALLOWED_URI_PROTOCOLS = ['http:', 'https:', 'git:', 'ssh:', 'file:'];
/**
 * Item 5: Guard against dangerous URI schemes (javascript:, data:, vbscript:).
 * If the value parses as a URL, its protocol must be in the allowlist.
 * If it does not parse as a URL (e.g. a relative path or git ref), it is accepted.
 */
function isAllowedUri(v) {
    try {
        const url = new URL(v);
        for (const allowed of ALLOWED_URI_PROTOCOLS) {
            if (url.protocol === allowed)
                return true;
        }
        return false;
    }
    catch {
        // Not a URL (no scheme), treat as a path or ref and accept.
        return true;
    }
}
export const artifactSchema = z.object({
    type: artifactTypeSchema,
    uri: z.string().min(1).refine(isAllowedUri, { message: 'unsupported artifact URI scheme' }),
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