import { z } from 'zod';

export const handprintTypeSchema = z.enum(['vision', 'choice', 'method']);
export type HandprintType = z.infer<typeof handprintTypeSchema>;

export const handprintStatusSchema = z.enum(['open', 'resolved']);
export type HandprintStatus = z.infer<typeof handprintStatusSchema>;

export const resolutionStatusSchema = z.enum([
  'validated',
  'partial',
  'revised',
  'invalidated',
]);
export type ResolutionStatus = z.infer<typeof resolutionStatusSchema>;

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

export const handprintSchema = z.object({
  seal: z.string(),
  madeAt: z.string(),
  type: handprintTypeSchema,
  subtype: z.string().optional(),
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
});
export type Handprint = z.infer<typeof handprintSchema>;
