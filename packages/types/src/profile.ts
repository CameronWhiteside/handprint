import { z } from 'zod';
import { registeredKeySchema } from './handprint.js';

// ── Social links ─────────────────────────────────────────────

export const socialLinkSchema = z.object({
  url: z.string(),
  verified: z.boolean().optional(),
});
export type SocialLink = z.infer<typeof socialLinkSchema>;

export const socialProfileSchema = z.object({
  github: socialLinkSchema.optional(),
  linkedin: socialLinkSchema.optional(),
  website: socialLinkSchema.optional(),
  email: socialLinkSchema.optional(),
});
export type SocialProfile = z.infer<typeof socialProfileSchema>;

// ── Profile ──────────────────────────────────────────────────

export const handprintProfileSchema = z.object({
  version: z.string(),
  generatedAt: z.string(),
  handle: z.string(),
  name: z.string(),
  social: socialProfileSchema.optional(),
  publicKeys: z.array(registeredKeySchema),
  typeCounts: z.object({
    vision: z.number(),
    choice: z.number(),
    method: z.number(),
  }),
  subtypeCounts: z.record(z.number()).optional(),
  total: z.number(),
  heatmap: z.array(
    z.object({
      date: z.string(),
      count: z.number(),
      level: z.number(),
    })
  ),
  streak: z.object({
    current: z.number(),
    longest: z.number(),
  }),
  firstHandprint: z.string().nullable(),
  merkleRoot: z.string().nullable(),
});
export type HandprintProfile = z.infer<typeof handprintProfileSchema>;

// ── Project config (.handprint/config.json) ──────────────────

export const projectConfigSchema = z.object({
  version: z.string(),
  createdAt: z.string(),
});
export type ProjectConfig = z.infer<typeof projectConfigSchema>;

// ── Global config (~/.handprint/config.json) ─────────────────

export const extractionConfigSchema = z.object({
  provider: z.enum(['local', 'host', 'ollama', 'openai']).optional(),
  model: z.string().optional(),
  agentCli: z.enum(['claude', 'opencode', 'codex']).optional(),
  sources: z.array(z.string()).optional(),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
});
export type ExtractionConfig = z.infer<typeof extractionConfigSchema>;

export const globalConfigSchema = z.object({
  version: z.string(),
  createdAt: z.string(),
  identity: z.object({
    handle: z.string(),
    name: z.string(),
    email: z.string(),
  }),
  social: socialProfileSchema.optional(),
  hub: z.object({
    url: z.string(),
  }),
  extraction: extractionConfigSchema.optional(),
});
export type GlobalConfig = z.infer<typeof globalConfigSchema>;
