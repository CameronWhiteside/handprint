import { z } from 'zod';
import { HANDPRINT_OBJECT_VERSION, handprintTypeSchema, allSubtypesSchema, markSchema, artifactSchema, sourceSchema, } from './handprint.js';
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
    v: z.literal(HANDPRINT_OBJECT_VERSION),
    ts: z.string(),
    marks: z.array(markSchema).min(1),
    artifacts: z.array(artifactSchema).default([]),
    source: sourceSchema,
    parent: z.string().nullable(),
    sig: z.string().min(1),
    pubkey: z.string().min(1),
});
// Batch push: many handprints in one request. Capped so a single request stays
// well under Workers body / Neon statement limits; the client chunks to this.
export const PUSH_HANDPRINTS_MAX = 500;
export const pushHandprintsInputSchema = z.object({
    handprints: z.array(pushHandprintInputSchema).min(1).max(PUSH_HANDPRINTS_MAX),
});
export const registerKeyInputSchema = z.object({
    pubkey: z.string().min(1),
    label: z.string().min(1).max(64),
});
// ── Path params ──────────────────────────────────────────────
const HANDLE_MAX = 64;
export const handleParamSchema = z.object({
    handle: z
        .string()
        .min(1)
        .max(HANDLE_MAX)
        .regex(/^[\w-]+$/),
});
// ── Handprint query (rich filtering) ─────────────────────────
const QUERY_LIMIT_MAX = 100;
const QUERY_LIMIT_DEFAULT = 50;
const SORT_OPTIONS = ['ts', '-ts'];
export const handprintsQuerySchema = z.object({
    type: handprintTypeSchema.optional(),
    subtype: allSubtypesSchema.optional(),
    agent: z.string().optional(),
    after: z.string().optional(),
    before: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(QUERY_LIMIT_MAX).default(QUERY_LIMIT_DEFAULT),
    offset: z.coerce.number().int().min(0).default(0),
    sort: z.enum(SORT_OPTIONS).default(SORT_OPTIONS[1]),
});
// ── Heatmap query ────────────────────────────────────────────
const HEATMAP_WEEKS_MAX = 104;
const HEATMAP_WEEKS_DEFAULT = 52;
export const heatmapQuerySchema = z.object({
    weeks: z.coerce.number().int().min(1).max(HEATMAP_WEEKS_MAX).default(HEATMAP_WEEKS_DEFAULT),
});
// ── Search ───────────────────────────────────────────────────
const SEARCH_Q_MAX = 256;
const SEARCH_LIMIT_MAX = 50;
const SEARCH_LIMIT_DEFAULT = 20;
export const searchQuerySchema = z.object({
    q: z.string().min(1).max(SEARCH_Q_MAX),
    type: handprintTypeSchema.optional(),
    limit: z.coerce.number().int().min(1).max(SEARCH_LIMIT_MAX).default(SEARCH_LIMIT_DEFAULT),
    offset: z.coerce.number().int().min(0).default(0),
});
// ── Device auth ──────────────────────────────────────────────
const TOKEN_TYPE = 'Bearer';
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
    tokenType: z.literal(TOKEN_TYPE),
    expiresIn: z.number().int(),
});
// ── Standard responses ───────────────────────────────────────
const VALIDATION_ERROR_STATUS = 400;
const VALIDATION_ERROR_MESSAGE = 'Validation Error';
export const apiErrorSchema = z.object({
    status: z.number().int(),
    message: z.string(),
    detail: z.string().optional(),
});
export const validationErrorSchema = z.object({
    status: z.literal(VALIDATION_ERROR_STATUS),
    message: z.literal(VALIDATION_ERROR_MESSAGE),
    issues: z.record(z.array(z.string())),
});
//# sourceMappingURL=api.js.map