import { z } from 'zod';

// ── Constants ────────────────────────────────────────────────

export const HANDPRINT_TYPES = ['vision', 'choice', 'method'] as const;
export const VISION_SUBTYPES = ['goal', 'direction', 'principle'] as const;
export const CHOICE_SUBTYPES = ['approval', 'override', 'rejection', 'constraint', 'inquiry'] as const;
export const METHOD_SUBTYPES = ['tool', 'knowledge', 'process'] as const;
export const HANDPRINT_STATUSES = ['open', 'resolved'] as const;
export const RESOLUTION_STATUSES = ['validated', 'partial', 'revised', 'invalidated'] as const;

export const ALL_SUBTYPES = [
  ...VISION_SUBTYPES,
  ...CHOICE_SUBTYPES,
  ...METHOD_SUBTYPES,
] as const;

export const SUBTYPES_BY_TYPE = {
  vision: VISION_SUBTYPES,
  choice: CHOICE_SUBTYPES,
  method: METHOD_SUBTYPES,
} as const;

// ── Type schemas ─────────────────────────────────────────────

export const handprintTypeSchema = z.enum(HANDPRINT_TYPES);
export type HandprintType = z.infer<typeof handprintTypeSchema>;

export const visionSubtypeSchema = z.enum(VISION_SUBTYPES);
export type VisionSubtype = z.infer<typeof visionSubtypeSchema>;

export const choiceSubtypeSchema = z.enum(CHOICE_SUBTYPES);
export type ChoiceSubtype = z.infer<typeof choiceSubtypeSchema>;

export const methodSubtypeSchema = z.enum(METHOD_SUBTYPES);
export type MethodSubtype = z.infer<typeof methodSubtypeSchema>;

export const allSubtypesSchema = z.enum(ALL_SUBTYPES);
export type Subtype = z.infer<typeof allSubtypesSchema>;

export const handprintStatusSchema = z.enum(HANDPRINT_STATUSES);
export type HandprintStatus = z.infer<typeof handprintStatusSchema>;

export const resolutionStatusSchema = z.enum(RESOLUTION_STATUSES);
export type ResolutionStatus = z.infer<typeof resolutionStatusSchema>;

export function subtypeSchemaForType(type: HandprintType) {
  const map = {
    vision: visionSubtypeSchema,
    choice: choiceSubtypeSchema,
    method: methodSubtypeSchema,
  } as const;
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
export type Mark = z.infer<typeof markSchema>;

// ── Building blocks ──────────────────────────────────────────

export const anchorSchema = z.object({
  label: z.string().min(1),
  verified: z.boolean(),
});
export type Anchor = z.infer<typeof anchorSchema>;

export const resolutionSchema = z.object({
  status: resolutionStatusSchema,
  body: z.string().min(1),
  timestamp: z.string(),
});
export type Resolution = z.infer<typeof resolutionSchema>;

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
export type Handprint = z.infer<typeof handprintSchema>;
