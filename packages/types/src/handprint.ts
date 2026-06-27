import { z } from 'zod';

// ── Types ────────────────────────────────────────────────────

export const handprintTypeSchema = z.enum(['vision', 'choice', 'method']);
export type HandprintType = z.infer<typeof handprintTypeSchema>;

// ── Subtypes (discriminated by type) ─────────────────────────

export const visionSubtypeSchema = z.enum(['goal', 'direction', 'principle']);
export type VisionSubtype = z.infer<typeof visionSubtypeSchema>;

export const choiceSubtypeSchema = z.enum([
  'approval',
  'override',
  'rejection',
  'constraint',
  'inquiry',
]);
export type ChoiceSubtype = z.infer<typeof choiceSubtypeSchema>;

export const methodSubtypeSchema = z.enum(['tool', 'knowledge', 'process', 'delegation']);
export type MethodSubtype = z.infer<typeof methodSubtypeSchema>;

export const subtypesByType = {
  vision: visionSubtypeSchema,
  choice: choiceSubtypeSchema,
  method: methodSubtypeSchema,
} as const;

export const allSubtypesSchema = z.enum([
  ...visionSubtypeSchema.options,
  ...choiceSubtypeSchema.options,
  ...methodSubtypeSchema.options,
]);
export type Subtype = z.infer<typeof allSubtypesSchema>;

export function subtypeSchemaForType(type: HandprintType) {
  return subtypesByType[type];
}

// ── Status ───────────────────────────────────────────────────

export const handprintStatusSchema = z.enum(['open', 'resolved']);
export type HandprintStatus = z.infer<typeof handprintStatusSchema>;

export const resolutionStatusSchema = z.enum([
  'validated',
  'partial',
  'revised',
  'invalidated',
]);
export type ResolutionStatus = z.infer<typeof resolutionStatusSchema>;

// ── Building blocks ──────────────────────────────────────────

export const anchorSchema = z.object({
  label: z.string(),
  verified: z.boolean(),
});
export type Anchor = z.infer<typeof anchorSchema>;

export const resolutionSchema = z.object({
  status: resolutionStatusSchema,
  body: z.string(),
  timestamp: z.string(),
});
export type Resolution = z.infer<typeof resolutionSchema>;

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
export type Handprint = z.infer<typeof handprintSchema>;
