import { z } from 'zod';
// ── Constants ────────────────────────────────────────────────
export const HANDPRINT_TYPES = ['vision', 'choice', 'method'];
export const VISION_SUBTYPES = ['goal', 'direction', 'principle'];
export const CHOICE_SUBTYPES = ['approval', 'override', 'rejection', 'constraint', 'inquiry'];
export const METHOD_SUBTYPES = ['tool', 'knowledge', 'process'];
export const HANDPRINT_STATUSES = ['open', 'resolved'];
export const RESOLUTION_STATUSES = ['validated', 'partial', 'revised', 'invalidated'];
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
// ── Type schemas ─────────────────────────────────────────────
export const handprintTypeSchema = z.enum(HANDPRINT_TYPES);
export const visionSubtypeSchema = z.enum(VISION_SUBTYPES);
export const choiceSubtypeSchema = z.enum(CHOICE_SUBTYPES);
export const methodSubtypeSchema = z.enum(METHOD_SUBTYPES);
export const allSubtypesSchema = z.enum(ALL_SUBTYPES);
export const handprintStatusSchema = z.enum(HANDPRINT_STATUSES);
export const resolutionStatusSchema = z.enum(RESOLUTION_STATUSES);
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
    note: z.string().min(1).max(280),
});
export const choiceMarkSchema = z.object({
    type: z.literal(HANDPRINT_TYPES[1]),
    subtype: choiceSubtypeSchema,
    note: z.string().min(1).max(280),
});
export const methodMarkSchema = z.object({
    type: z.literal(HANDPRINT_TYPES[2]),
    subtype: methodSubtypeSchema,
    note: z.string().min(1).max(280),
});
export const markSchema = z.discriminatedUnion('type', [
    visionMarkSchema,
    choiceMarkSchema,
    methodMarkSchema,
]);
// ── Building blocks ──────────────────────────────────────────
export const anchorSchema = z.object({
    label: z.string().min(1),
    verified: z.boolean(),
});
export const resolutionSchema = z.object({
    status: resolutionStatusSchema,
    body: z.string().min(1),
    timestamp: z.string(),
});
// ── Handprint ────────────────────────────────────────────────
export const handprintSchema = z.object({
    signature: z.string().min(1),
    madeAt: z.string(),
    intent: z.string().min(1),
    risk: z.string().min(1),
    context: z.string().min(1),
    marks: z.array(markSchema).min(1),
    project: z.string().optional(),
    repo: z.string().optional(),
    branch: z.string().optional(),
    confidence: z.number().min(0).max(1).nullable(),
    horizon: z.string().nullable(),
    anchors: z.array(anchorSchema),
    source: z.string().min(1),
    status: handprintStatusSchema,
    outcome: z.string().optional(),
    resolutions: z.array(resolutionSchema),
});
//# sourceMappingURL=handprint.js.map