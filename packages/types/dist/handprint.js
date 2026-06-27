import { z } from 'zod';
// ── Types ────────────────────────────────────────────────────
export const handprintTypeSchema = z.enum(['vision', 'choice', 'method']);
// ── Subtypes (discriminated by type) ─────────────────────────
export const visionSubtypeSchema = z.enum(['goal', 'direction', 'principle']);
export const choiceSubtypeSchema = z.enum([
    'approval',
    'override',
    'rejection',
    'constraint',
    'inquiry',
]);
export const methodSubtypeSchema = z.enum(['tool', 'knowledge', 'process', 'delegation']);
export const subtypesByType = {
    vision: visionSubtypeSchema,
    choice: choiceSubtypeSchema,
    method: methodSubtypeSchema,
};
export const allSubtypesSchema = z.enum([
    ...visionSubtypeSchema.options,
    ...choiceSubtypeSchema.options,
    ...methodSubtypeSchema.options,
]);
export function subtypeSchemaForType(type) {
    return subtypesByType[type];
}
// ── Status ───────────────────────────────────────────────────
export const handprintStatusSchema = z.enum(['open', 'resolved']);
export const resolutionStatusSchema = z.enum([
    'validated',
    'partial',
    'revised',
    'invalidated',
]);
// ── Building blocks ──────────────────────────────────────────
export const anchorSchema = z.object({
    label: z.string(),
    verified: z.boolean(),
});
export const resolutionSchema = z.object({
    status: resolutionStatusSchema,
    body: z.string(),
    timestamp: z.string(),
});
// ── Handprint (discriminated union by type) ──────────────────
const handprintBase = {
    signature: z.string(),
    madeAt: z.string(),
    intent: z.string(),
    risk: z.string(),
    context: z.string(),
    project: z.string().optional(),
    repo: z.string().optional(),
    branch: z.string().optional(),
    confidence: z.number().nullable(),
    horizon: z.string().nullable(),
    anchors: z.array(anchorSchema),
    source: z.string(),
    status: handprintStatusSchema,
    outcome: z.string().optional(),
    resolutions: z.array(resolutionSchema),
};
export const visionHandprintSchema = z.object({
    ...handprintBase,
    type: z.literal('vision'),
    subtype: visionSubtypeSchema.optional(),
});
export const choiceHandprintSchema = z.object({
    ...handprintBase,
    type: z.literal('choice'),
    subtype: choiceSubtypeSchema.optional(),
});
export const methodHandprintSchema = z.object({
    ...handprintBase,
    type: z.literal('method'),
    subtype: methodSubtypeSchema.optional(),
});
export const handprintSchema = z.discriminatedUnion('type', [
    visionHandprintSchema,
    choiceHandprintSchema,
    methodHandprintSchema,
]);
//# sourceMappingURL=handprint.js.map