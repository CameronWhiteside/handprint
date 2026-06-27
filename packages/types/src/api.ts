import { z } from 'zod';
import {
  HANDPRINT_TYPES,
  HANDPRINT_STATUSES,
  ALL_SUBTYPES,
  handprintTypeSchema,
  handprintStatusSchema,
  allSubtypesSchema,
  markSchema,
  anchorSchema,
  resolutionSchema,
} from './handprint.js';

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
export type PushProfileInput = z.infer<typeof pushProfileInputSchema>;

export const pushHandprintInputSchema = z.object({
  signature: z.string().min(1),
  madeAt: z.string(),
  intent: z.string().min(1),
  risk: z.string().min(1),
  context: z.string().min(1),
  marks: z.array(markSchema).min(1),
  project: z.string().optional(),
  repo: z.string().optional(),
  branch: z.string().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  horizon: z.string().nullable().optional(),
  source: z.string().optional(),
  status: handprintStatusSchema.default(HANDPRINT_STATUSES[0]),
  outcome: z.string().optional(),
  anchors: z.array(anchorSchema).default([]),
  resolutions: z.array(resolutionSchema).default([]),
});
export type PushHandprintInput = z.infer<typeof pushHandprintInputSchema>;

// ── Path params ──────────────────────────────────────────────

const HANDLE_MAX = 64 as const;

export const handleParamSchema = z.object({
  handle: z
    .string()
    .min(1)
    .max(HANDLE_MAX)
    .regex(/^[\w-]+$/),
});
export type HandleParam = z.infer<typeof handleParamSchema>;

// ── Handprint query (rich filtering) ─────────────────────────

const QUERY_LIMIT_MAX = 100 as const;
const QUERY_LIMIT_DEFAULT = 50 as const;
const SORT_OPTIONS = ['madeAt', '-madeAt'] as const;

export const handprintsQuerySchema = z.object({
  type: handprintTypeSchema.optional(),
  subtype: allSubtypesSchema.optional(),
  status: handprintStatusSchema.optional(),
  repo: z.string().optional(),
  project: z.string().optional(),
  source: z.string().optional(),
  after: z.string().optional(),
  before: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(QUERY_LIMIT_MAX).default(QUERY_LIMIT_DEFAULT),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(SORT_OPTIONS).default(SORT_OPTIONS[1]),
});
export type HandprintsQuery = z.infer<typeof handprintsQuerySchema>;

// ── Heatmap query ────────────────────────────────────────────

const HEATMAP_WEEKS_MAX = 104 as const;
const HEATMAP_WEEKS_DEFAULT = 52 as const;

export const heatmapQuerySchema = z.object({
  weeks: z.coerce.number().int().min(1).max(HEATMAP_WEEKS_MAX).default(HEATMAP_WEEKS_DEFAULT),
});
export type HeatmapQuery = z.infer<typeof heatmapQuerySchema>;

// ── Repos query ──────────────────────────────────────────────

const REPOS_LIMIT_MAX = 50 as const;
const REPOS_LIMIT_DEFAULT = 20 as const;

export const reposQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(REPOS_LIMIT_MAX).default(REPOS_LIMIT_DEFAULT),
});
export type ReposQuery = z.infer<typeof reposQuerySchema>;

// ── Search ───────────────────────────────────────────────────

const SEARCH_Q_MAX = 256 as const;
const SEARCH_LIMIT_MAX = 50 as const;
const SEARCH_LIMIT_DEFAULT = 20 as const;
const SEARCH_DOMAIN_MAX = 128 as const;

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(SEARCH_Q_MAX),
  type: handprintTypeSchema.optional(),
  domain: z.string().max(SEARCH_DOMAIN_MAX).optional(),
  limit: z.coerce.number().int().min(1).max(SEARCH_LIMIT_MAX).default(SEARCH_LIMIT_DEFAULT),
  offset: z.coerce.number().int().min(0).default(0),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

// ── Device auth ──────────────────────────────────────────────

const TOKEN_TYPE = 'Bearer' as const;

export const deviceCodeResponseSchema = z.object({
  status: z.literal(200),
  deviceCode: z.string(),
  userCode: z.string(),
  verificationUrl: z.string(),
  expiresIn: z.number().int(),
  interval: z.number().int(),
});
export type DeviceCodeResponse = z.infer<typeof deviceCodeResponseSchema>;

export const deviceTokenRequestSchema = z.object({
  device_code: z.string().min(1),
});
export type DeviceTokenRequest = z.infer<typeof deviceTokenRequestSchema>;

export const deviceTokenResponseSchema = z.object({
  status: z.literal(200),
  accessToken: z.string(),
  tokenType: z.literal(TOKEN_TYPE),
  expiresIn: z.number().int(),
});
export type DeviceTokenResponse = z.infer<typeof deviceTokenResponseSchema>;

// ── Standard responses ───────────────────────────────────────

const VALIDATION_ERROR_STATUS = 400 as const;
const VALIDATION_ERROR_MESSAGE = 'Validation Error' as const;

export const apiErrorSchema = z.object({
  status: z.number().int(),
  message: z.string(),
  detail: z.string().optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export const validationErrorSchema = z.object({
  status: z.literal(VALIDATION_ERROR_STATUS),
  message: z.literal(VALIDATION_ERROR_MESSAGE),
  issues: z.record(z.array(z.string())),
});
export type ValidationError = z.infer<typeof validationErrorSchema>;
