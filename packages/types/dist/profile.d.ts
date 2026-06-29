import { z } from 'zod';
export declare const socialLinkSchema: z.ZodObject<{
    url: z.ZodString;
    verified: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    url: string;
    verified?: boolean | undefined;
}, {
    url: string;
    verified?: boolean | undefined;
}>;
export type SocialLink = z.infer<typeof socialLinkSchema>;
export declare const socialProfileSchema: z.ZodObject<{
    github: z.ZodOptional<z.ZodObject<{
        url: z.ZodString;
        verified: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        url: string;
        verified?: boolean | undefined;
    }, {
        url: string;
        verified?: boolean | undefined;
    }>>;
    linkedin: z.ZodOptional<z.ZodObject<{
        url: z.ZodString;
        verified: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        url: string;
        verified?: boolean | undefined;
    }, {
        url: string;
        verified?: boolean | undefined;
    }>>;
    website: z.ZodOptional<z.ZodObject<{
        url: z.ZodString;
        verified: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        url: string;
        verified?: boolean | undefined;
    }, {
        url: string;
        verified?: boolean | undefined;
    }>>;
    email: z.ZodOptional<z.ZodObject<{
        url: z.ZodString;
        verified: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        url: string;
        verified?: boolean | undefined;
    }, {
        url: string;
        verified?: boolean | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    github?: {
        url: string;
        verified?: boolean | undefined;
    } | undefined;
    linkedin?: {
        url: string;
        verified?: boolean | undefined;
    } | undefined;
    website?: {
        url: string;
        verified?: boolean | undefined;
    } | undefined;
    email?: {
        url: string;
        verified?: boolean | undefined;
    } | undefined;
}, {
    github?: {
        url: string;
        verified?: boolean | undefined;
    } | undefined;
    linkedin?: {
        url: string;
        verified?: boolean | undefined;
    } | undefined;
    website?: {
        url: string;
        verified?: boolean | undefined;
    } | undefined;
    email?: {
        url: string;
        verified?: boolean | undefined;
    } | undefined;
}>;
export type SocialProfile = z.infer<typeof socialProfileSchema>;
export declare const handprintProfileSchema: z.ZodObject<{
    version: z.ZodString;
    generatedAt: z.ZodString;
    handle: z.ZodString;
    name: z.ZodString;
    social: z.ZodOptional<z.ZodObject<{
        github: z.ZodOptional<z.ZodObject<{
            url: z.ZodString;
            verified: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            url: string;
            verified?: boolean | undefined;
        }, {
            url: string;
            verified?: boolean | undefined;
        }>>;
        linkedin: z.ZodOptional<z.ZodObject<{
            url: z.ZodString;
            verified: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            url: string;
            verified?: boolean | undefined;
        }, {
            url: string;
            verified?: boolean | undefined;
        }>>;
        website: z.ZodOptional<z.ZodObject<{
            url: z.ZodString;
            verified: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            url: string;
            verified?: boolean | undefined;
        }, {
            url: string;
            verified?: boolean | undefined;
        }>>;
        email: z.ZodOptional<z.ZodObject<{
            url: z.ZodString;
            verified: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            url: string;
            verified?: boolean | undefined;
        }, {
            url: string;
            verified?: boolean | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        github?: {
            url: string;
            verified?: boolean | undefined;
        } | undefined;
        linkedin?: {
            url: string;
            verified?: boolean | undefined;
        } | undefined;
        website?: {
            url: string;
            verified?: boolean | undefined;
        } | undefined;
        email?: {
            url: string;
            verified?: boolean | undefined;
        } | undefined;
    }, {
        github?: {
            url: string;
            verified?: boolean | undefined;
        } | undefined;
        linkedin?: {
            url: string;
            verified?: boolean | undefined;
        } | undefined;
        website?: {
            url: string;
            verified?: boolean | undefined;
        } | undefined;
        email?: {
            url: string;
            verified?: boolean | undefined;
        } | undefined;
    }>>;
    publicKeys: z.ZodArray<z.ZodObject<{
        pubkey: z.ZodString;
        fingerprint: z.ZodString;
        label: z.ZodString;
        addedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        pubkey: string;
        fingerprint: string;
        label: string;
        addedAt: string;
    }, {
        pubkey: string;
        fingerprint: string;
        label: string;
        addedAt: string;
    }>, "many">;
    typeCounts: z.ZodObject<{
        vision: z.ZodNumber;
        choice: z.ZodNumber;
        method: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        vision: number;
        choice: number;
        method: number;
    }, {
        vision: number;
        choice: number;
        method: number;
    }>;
    subtypeCounts: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    total: z.ZodNumber;
    heatmap: z.ZodArray<z.ZodObject<{
        date: z.ZodString;
        count: z.ZodNumber;
        level: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        date: string;
        count: number;
        level: number;
    }, {
        date: string;
        count: number;
        level: number;
    }>, "many">;
    streak: z.ZodObject<{
        current: z.ZodNumber;
        longest: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        current: number;
        longest: number;
    }, {
        current: number;
        longest: number;
    }>;
    firstHandprint: z.ZodNullable<z.ZodString>;
    merkleRoot: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    handle: string;
    version: string;
    generatedAt: string;
    name: string;
    publicKeys: {
        pubkey: string;
        fingerprint: string;
        label: string;
        addedAt: string;
    }[];
    typeCounts: {
        vision: number;
        choice: number;
        method: number;
    };
    total: number;
    heatmap: {
        date: string;
        count: number;
        level: number;
    }[];
    streak: {
        current: number;
        longest: number;
    };
    firstHandprint: string | null;
    merkleRoot: string | null;
    social?: {
        github?: {
            url: string;
            verified?: boolean | undefined;
        } | undefined;
        linkedin?: {
            url: string;
            verified?: boolean | undefined;
        } | undefined;
        website?: {
            url: string;
            verified?: boolean | undefined;
        } | undefined;
        email?: {
            url: string;
            verified?: boolean | undefined;
        } | undefined;
    } | undefined;
    subtypeCounts?: Record<string, number> | undefined;
}, {
    handle: string;
    version: string;
    generatedAt: string;
    name: string;
    publicKeys: {
        pubkey: string;
        fingerprint: string;
        label: string;
        addedAt: string;
    }[];
    typeCounts: {
        vision: number;
        choice: number;
        method: number;
    };
    total: number;
    heatmap: {
        date: string;
        count: number;
        level: number;
    }[];
    streak: {
        current: number;
        longest: number;
    };
    firstHandprint: string | null;
    merkleRoot: string | null;
    social?: {
        github?: {
            url: string;
            verified?: boolean | undefined;
        } | undefined;
        linkedin?: {
            url: string;
            verified?: boolean | undefined;
        } | undefined;
        website?: {
            url: string;
            verified?: boolean | undefined;
        } | undefined;
        email?: {
            url: string;
            verified?: boolean | undefined;
        } | undefined;
    } | undefined;
    subtypeCounts?: Record<string, number> | undefined;
}>;
export type HandprintProfile = z.infer<typeof handprintProfileSchema>;
export declare const projectConfigSchema: z.ZodObject<{
    version: z.ZodString;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    version: string;
    createdAt: string;
}, {
    version: string;
    createdAt: string;
}>;
export type ProjectConfig = z.infer<typeof projectConfigSchema>;
export declare const extractionConfigSchema: z.ZodObject<{
    provider: z.ZodOptional<z.ZodEnum<["local", "host", "openai"]>>;
    model: z.ZodOptional<z.ZodString>;
    agentCli: z.ZodOptional<z.ZodEnum<["claude", "opencode", "codex"]>>;
    sources: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    baseUrl: z.ZodOptional<z.ZodString>;
    apiKey: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    provider?: "local" | "host" | "openai" | undefined;
    model?: string | undefined;
    agentCli?: "claude" | "opencode" | "codex" | undefined;
    sources?: string[] | undefined;
    baseUrl?: string | undefined;
    apiKey?: string | undefined;
}, {
    provider?: "local" | "host" | "openai" | undefined;
    model?: string | undefined;
    agentCli?: "claude" | "opencode" | "codex" | undefined;
    sources?: string[] | undefined;
    baseUrl?: string | undefined;
    apiKey?: string | undefined;
}>;
export type ExtractionConfig = z.infer<typeof extractionConfigSchema>;
export declare const globalConfigSchema: z.ZodObject<{
    version: z.ZodString;
    createdAt: z.ZodString;
    identity: z.ZodObject<{
        handle: z.ZodString;
        name: z.ZodString;
        email: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        handle: string;
        email: string;
        name: string;
    }, {
        handle: string;
        email: string;
        name: string;
    }>;
    social: z.ZodOptional<z.ZodObject<{
        github: z.ZodOptional<z.ZodObject<{
            url: z.ZodString;
            verified: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            url: string;
            verified?: boolean | undefined;
        }, {
            url: string;
            verified?: boolean | undefined;
        }>>;
        linkedin: z.ZodOptional<z.ZodObject<{
            url: z.ZodString;
            verified: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            url: string;
            verified?: boolean | undefined;
        }, {
            url: string;
            verified?: boolean | undefined;
        }>>;
        website: z.ZodOptional<z.ZodObject<{
            url: z.ZodString;
            verified: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            url: string;
            verified?: boolean | undefined;
        }, {
            url: string;
            verified?: boolean | undefined;
        }>>;
        email: z.ZodOptional<z.ZodObject<{
            url: z.ZodString;
            verified: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            url: string;
            verified?: boolean | undefined;
        }, {
            url: string;
            verified?: boolean | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        github?: {
            url: string;
            verified?: boolean | undefined;
        } | undefined;
        linkedin?: {
            url: string;
            verified?: boolean | undefined;
        } | undefined;
        website?: {
            url: string;
            verified?: boolean | undefined;
        } | undefined;
        email?: {
            url: string;
            verified?: boolean | undefined;
        } | undefined;
    }, {
        github?: {
            url: string;
            verified?: boolean | undefined;
        } | undefined;
        linkedin?: {
            url: string;
            verified?: boolean | undefined;
        } | undefined;
        website?: {
            url: string;
            verified?: boolean | undefined;
        } | undefined;
        email?: {
            url: string;
            verified?: boolean | undefined;
        } | undefined;
    }>>;
    hub: z.ZodObject<{
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        url: string;
    }, {
        url: string;
    }>;
    extraction: z.ZodOptional<z.ZodObject<{
        provider: z.ZodOptional<z.ZodEnum<["local", "host", "openai"]>>;
        model: z.ZodOptional<z.ZodString>;
        agentCli: z.ZodOptional<z.ZodEnum<["claude", "opencode", "codex"]>>;
        sources: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        baseUrl: z.ZodOptional<z.ZodString>;
        apiKey: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        provider?: "local" | "host" | "openai" | undefined;
        model?: string | undefined;
        agentCli?: "claude" | "opencode" | "codex" | undefined;
        sources?: string[] | undefined;
        baseUrl?: string | undefined;
        apiKey?: string | undefined;
    }, {
        provider?: "local" | "host" | "openai" | undefined;
        model?: string | undefined;
        agentCli?: "claude" | "opencode" | "codex" | undefined;
        sources?: string[] | undefined;
        baseUrl?: string | undefined;
        apiKey?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    version: string;
    createdAt: string;
    identity: {
        handle: string;
        email: string;
        name: string;
    };
    hub: {
        url: string;
    };
    social?: {
        github?: {
            url: string;
            verified?: boolean | undefined;
        } | undefined;
        linkedin?: {
            url: string;
            verified?: boolean | undefined;
        } | undefined;
        website?: {
            url: string;
            verified?: boolean | undefined;
        } | undefined;
        email?: {
            url: string;
            verified?: boolean | undefined;
        } | undefined;
    } | undefined;
    extraction?: {
        provider?: "local" | "host" | "openai" | undefined;
        model?: string | undefined;
        agentCli?: "claude" | "opencode" | "codex" | undefined;
        sources?: string[] | undefined;
        baseUrl?: string | undefined;
        apiKey?: string | undefined;
    } | undefined;
}, {
    version: string;
    createdAt: string;
    identity: {
        handle: string;
        email: string;
        name: string;
    };
    hub: {
        url: string;
    };
    social?: {
        github?: {
            url: string;
            verified?: boolean | undefined;
        } | undefined;
        linkedin?: {
            url: string;
            verified?: boolean | undefined;
        } | undefined;
        website?: {
            url: string;
            verified?: boolean | undefined;
        } | undefined;
        email?: {
            url: string;
            verified?: boolean | undefined;
        } | undefined;
    } | undefined;
    extraction?: {
        provider?: "local" | "host" | "openai" | undefined;
        model?: string | undefined;
        agentCli?: "claude" | "opencode" | "codex" | undefined;
        sources?: string[] | undefined;
        baseUrl?: string | undefined;
        apiKey?: string | undefined;
    } | undefined;
}>;
export type GlobalConfig = z.infer<typeof globalConfigSchema>;
