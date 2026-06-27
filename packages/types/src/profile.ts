import { z } from 'zod';
import { handprintTypeSchema, anchorSchema, resolutionSchema } from './handprint.js';

export const visibilitySchema = z.enum(['public', 'connections', 'private']);
export type Visibility = z.infer<typeof visibilitySchema>;

export const socialLinkSchema = z.object({
  url: z.string(),
  visibility: visibilitySchema,
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

export const timelineEntrySchema = z.object({
  signature: z.string(),
  type: handprintTypeSchema,
  subtype: z.string().optional(),
  context: z.string(),
  intent: z.string(),
  risk: z.string(),
  status: z.string(),
  horizon: z.string().nullable(),
  anchors: z.array(anchorSchema),
  resolutions: z.array(resolutionSchema),
});
export type TimelineEntry = z.infer<typeof timelineEntrySchema>;

export const timelineMonthSchema = z.object({
  month: z.string(),
  entries: z.array(timelineEntrySchema),
});
export type TimelineMonth = z.infer<typeof timelineMonthSchema>;

export const handprintProfileSchema = z.object({
  version: z.string(),
  generatedAt: z.string(),
  handle: z.string(),
  name: z.string(),
  social: socialProfileSchema.optional(),
  typeCounts: z.object({
    vision: z.number(),
    choice: z.number(),
    method: z.number(),
  }),
  subtypeCounts: z.record(z.number()).optional(),
  total: z.number(),
  calibration: z.object({
    score: z.number().nullable(),
    resolved: z.number(),
    open: z.number(),
    breakdown: z.object({
      validated: z.number(),
      partial: z.number(),
      revised: z.number(),
      invalidated: z.number(),
    }),
    formula: z.string(),
  }),
  domains: z.array(
    z.object({
      name: z.string(),
      count: z.number(),
      percentage: z.number(),
      strong: z.boolean(),
    })
  ),
  tools: z.array(
    z.object({
      name: z.string(),
      count: z.number(),
      percentage: z.number(),
    })
  ),
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
  firstHandprint: z.string(),
  featured: z
    .object({
      hash: z.string(),
      strategy: z.string(),
    })
    .nullable(),
  timeline: z.array(timelineMonthSchema),
  repos: z.array(
    z.object({
      url: z.string(),
      handprintCount: z.number(),
    })
  ),
  merkleRoot: z.string().nullable(),
});
export type HandprintProfile = z.infer<typeof handprintProfileSchema>;

export const protocolConfigSchema = z.object({
  calibration: z.object({
    weights: z.object({
      validated: z.number(),
      partial: z.number(),
      revised: z.number(),
      invalidated: z.number(),
    }),
    minResolved: z.number(),
  }),
  domains: z.object({ strongThreshold: z.number() }),
  heatmap: z.object({ weeks: z.number(), levels: z.number() }),
  featured: z.object({ strategy: z.string() }),
  anchors: z.object({
    commitWindowBefore: z.string(),
    commitWindowAfter: z.string(),
    linkPRs: z.boolean(),
    linkRepo: z.boolean(),
  }),
});
export type ProtocolConfig = z.infer<typeof protocolConfigSchema>;

export const handprintConfigSchema = z.object({
  version: z.string(),
  createdAt: z.string(),
  identity: z.object({
    handle: z.string(),
    name: z.string(),
    email: z.string(),
  }),
  social: socialProfileSchema.optional(),
  remote: z.object({
    type: z.string(),
    accountId: z.string(),
    namespaceId: z.string().nullable(),
  }),
  protocol: protocolConfigSchema,
});
export type HandprintConfig = z.infer<typeof handprintConfigSchema>;
