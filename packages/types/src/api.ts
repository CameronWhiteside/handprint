import { z } from 'zod';
import {
  HANDPRINT_OBJECT_VERSION,
  handprintTypeSchema,
  allSubtypesSchema,
  markSchema,
  artifactSchema,
  sourceSchema,
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
  v: z.literal(HANDPRINT_OBJECT_VERSION),
  ts: z.string(),
  marks: z.array(markSchema).min(1),
  artifacts: z.array(artifactSchema).default([]),
  source: sourceSchema,
  parent: z.string().nullable(),
  sig: z.string().min(1),
  pubkey: z.string().min(1),
});
export type PushHandprintInput = z.infer<typeof pushHandprintInputSchema>;

export const registerKeyInputSchema = z.object({
  pubkey: z.string().min(1),
  label: z.string().min(1).max(64),
});
export type RegisterKeyInput = z.infer<typeof registerKeyInputSchema>;

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
const SORT_OPTIONS = ['ts', '-ts'] as const;

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
export type HandprintsQuery = z.infer<typeof handprintsQuerySchema>;

// ── Heatmap query ────────────────────────────────────────────

const HEATMAP_WEEKS_MAX = 104 as const;
const HEATMAP_WEEKS_DEFAULT = 52 as const;

export const heatmapQuerySchema = z.object({
  weeks: z.coerce.number().int().min(1).max(HEATMAP_WEEKS_MAX).default(HEATMAP_WEEKS_DEFAULT),
});
export type HeatmapQuery = z.infer<typeof heatmapQuerySchema>;

// ── Search ───────────────────────────────────────────────────

const SEARCH_Q_MAX = 256 as const;
const SEARCH_LIMIT_MAX = 50 as const;
const SEARCH_LIMIT_DEFAULT = 20 as const;

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(SEARCH_Q_MAX),
  type: handprintTypeSchema.optional(),
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
