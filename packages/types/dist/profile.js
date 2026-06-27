import { z } from 'zod';
import { VISIBILITY_LEVELS, visibilitySchema, registeredKeySchema } from './handprint.js';
// ── Social links ─────────────────────────────────────────────
export const socialLinkSchema = z.object({
    url: z.string(),
    visibility: visibilitySchema,
    verified: z.boolean().optional(),
});
export const socialProfileSchema = z.object({
    github: socialLinkSchema.optional(),
    linkedin: socialLinkSchema.optional(),
    website: socialLinkSchema.optional(),
    email: socialLinkSchema.optional(),
});
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
    heatmap: z.array(z.object({
        date: z.string(),
        count: z.number(),
        level: z.number(),
    })),
    streak: z.object({
        current: z.number(),
        longest: z.number(),
    }),
    firstHandprint: z.string().nullable(),
    merkleRoot: z.string().nullable(),
});
// ── Project config (.handprint/config.json) ──────────────────
export const projectConfigSchema = z.object({
    version: z.string(),
    visibility: visibilitySchema.default(VISIBILITY_LEVELS[0]),
    createdAt: z.string(),
});
// ── Global config (~/.handprint/config.json) ─────────────────
export const extractionConfigSchema = z.object({
    provider: z.enum(['local', 'host']).optional(),
    model: z.string().optional(),
    agentCli: z.enum(['claude', 'opencode', 'codex']).optional(),
    sources: z.array(z.string()).optional(),
});
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
//# sourceMappingURL=profile.js.map