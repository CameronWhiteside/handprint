import { z } from 'zod';
import { handprintTypeSchema, anchorSchema, resolutionSchema } from './handprint.js';
// ── Push payloads ────────────────────────────────────────────
export const pushProfileInputSchema = z.object({
    handle: z
        .string()
        .min(1)
        .max(64)
        .regex(/^@?[\w-]+$/),
    profile: z.record(z.unknown()),
    meta: z.record(z.unknown()).optional(),
});
export const pushHandprintInputSchema = z.object({
    seal: z.string().min(1),
    type: handprintTypeSchema,
    subtype: z.string().optional(),
    madeAt: z.string(),
    intent: z.string().min(1),
    risk: z.string().min(1),
    context: z.string().min(1),
    project: z.string().optional(),
    repo: z.string().optional(),
    branch: z.string().optional(),
    confidence: z.number().min(0).max(1).nullable().optional(),
    horizon: z.string().nullable().optional(),
    source: z.string().optional(),
    status: z.enum(['open', 'resolved']).default('open'),
    outcome: z.string().optional(),
    anchors: z.array(anchorSchema).default([]),
    resolutions: z.array(resolutionSchema).default([]),
});
// ── Path params ──────────────────────────────────────────────
export const handleParamSchema = z.object({
    handle: z
        .string()
        .min(1)
        .max(64)
        .regex(/^[\w-]+$/),
});
// ── Handprint query (rich filtering) ─────────────────────────
export const handprintsQuerySchema = z.object({
    type: handprintTypeSchema.optional(),
    subtype: z.string().optional(),
    status: z.enum(['open', 'resolved']).optional(),
    repo: z.string().optional(),
    project: z.string().optional(),
    source: z.string().optional(),
    after: z.string().optional(),
    before: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
    sort: z.enum(['madeAt', '-madeAt']).default('-madeAt'),
});
// ── Heatmap query ────────────────────────────────────────────
export const heatmapQuerySchema = z.object({
    weeks: z.coerce.number().int().min(1).max(104).default(52),
});
// ── Repos query ──────────────────────────────────────────────
export const reposQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
});
// ── Search ───────────────────────────────────────────────────
export const searchQuerySchema = z.object({
    q: z.string().min(1).max(256),
    type: handprintTypeSchema.optional(),
    domain: z.string().max(128).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    offset: z.coerce.number().int().min(0).default(0),
});
// ── Device auth ──────────────────────────────────────────────
export const deviceCodeResponseSchema = z.object({
    status: z.literal(200),
    deviceCode: z.string(),
    userCode: z.string(),
    verificationUrl: z.string(),
    expiresIn: z.number().int(),
    interval: z.number().int(),
});
export const deviceTokenRequestSchema = z.object({
    device_code: z.string().min(1),
});
export const deviceTokenResponseSchema = z.object({
    status: z.literal(200),
    accessToken: z.string(),
    tokenType: z.literal('Bearer'),
    expiresIn: z.number().int(),
});
// ── Standard responses ───────────────────────────────────────
export const apiErrorSchema = z.object({
    status: z.number().int(),
    message: z.string(),
    detail: z.string().optional(),
});
export const validationErrorSchema = z.object({
    status: z.literal(400),
    message: z.literal('Validation Error'),
    issues: z.record(z.array(z.string())),
});
//# sourceMappingURL=api.js.map