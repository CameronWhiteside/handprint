import { z } from 'zod';
export declare const visibilitySchema: z.ZodEnum<["public", "connections", "private"]>;
export type Visibility = z.infer<typeof visibilitySchema>;
export declare const socialLinkSchema: z.ZodObject<{
    url: z.ZodString;
    visibility: z.ZodEnum<["public", "connections", "private"]>;
    verified: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    url: string;
    visibility: "public" | "connections" | "private";
    verified?: boolean | undefined;
}, {
    url: string;
    visibility: "public" | "connections" | "private";
    verified?: boolean | undefined;
}>;
export type SocialLink = z.infer<typeof socialLinkSchema>;
export declare const socialProfileSchema: z.ZodObject<{
    github: z.ZodOptional<z.ZodObject<{
        url: z.ZodString;
        visibility: z.ZodEnum<["public", "connections", "private"]>;
        verified: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        url: string;
        visibility: "public" | "connections" | "private";
        verified?: boolean | undefined;
    }, {
        url: string;
        visibility: "public" | "connections" | "private";
        verified?: boolean | undefined;
    }>>;
    linkedin: z.ZodOptional<z.ZodObject<{
        url: z.ZodString;
        visibility: z.ZodEnum<["public", "connections", "private"]>;
        verified: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        url: string;
        visibility: "public" | "connections" | "private";
        verified?: boolean | undefined;
    }, {
        url: string;
        visibility: "public" | "connections" | "private";
        verified?: boolean | undefined;
    }>>;
    website: z.ZodOptional<z.ZodObject<{
        url: z.ZodString;
        visibility: z.ZodEnum<["public", "connections", "private"]>;
        verified: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        url: string;
        visibility: "public" | "connections" | "private";
        verified?: boolean | undefined;
    }, {
        url: string;
        visibility: "public" | "connections" | "private";
        verified?: boolean | undefined;
    }>>;
    email: z.ZodOptional<z.ZodObject<{
        url: z.ZodString;
        visibility: z.ZodEnum<["public", "connections", "private"]>;
        verified: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        url: string;
        visibility: "public" | "connections" | "private";
        verified?: boolean | undefined;
    }, {
        url: string;
        visibility: "public" | "connections" | "private";
        verified?: boolean | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    github?: {
        url: string;
        visibility: "public" | "connections" | "private";
        verified?: boolean | undefined;
    } | undefined;
    linkedin?: {
        url: string;
        visibility: "public" | "connections" | "private";
        verified?: boolean | undefined;
    } | undefined;
    website?: {
        url: string;
        visibility: "public" | "connections" | "private";
        verified?: boolean | undefined;
    } | undefined;
    email?: {
        url: string;
        visibility: "public" | "connections" | "private";
        verified?: boolean | undefined;
    } | undefined;
}, {
    github?: {
        url: string;
        visibility: "public" | "connections" | "private";
        verified?: boolean | undefined;
    } | undefined;
    linkedin?: {
        url: string;
        visibility: "public" | "connections" | "private";
        verified?: boolean | undefined;
    } | undefined;
    website?: {
        url: string;
        visibility: "public" | "connections" | "private";
        verified?: boolean | undefined;
    } | undefined;
    email?: {
        url: string;
        visibility: "public" | "connections" | "private";
        verified?: boolean | undefined;
    } | undefined;
}>;
export type SocialProfile = z.infer<typeof socialProfileSchema>;
export declare const timelineEntrySchema: z.ZodObject<{
    seal: z.ZodString;
    type: z.ZodEnum<["vision", "choice", "method"]>;
    subtype: z.ZodOptional<z.ZodString>;
    context: z.ZodString;
    intent: z.ZodString;
    risk: z.ZodString;
    status: z.ZodString;
    horizon: z.ZodNullable<z.ZodString>;
    anchors: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        verified: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        label: string;
        verified: boolean;
    }, {
        label: string;
        verified: boolean;
    }>, "many">;
    resolutions: z.ZodArray<z.ZodObject<{
        status: z.ZodEnum<["validated", "partial", "revised", "invalidated"]>;
        body: z.ZodString;
        timestamp: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "validated" | "partial" | "revised" | "invalidated";
        body: string;
        timestamp: string;
    }, {
        status: "validated" | "partial" | "revised" | "invalidated";
        body: string;
        timestamp: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "vision" | "choice" | "method";
    status: string;
    seal: string;
    intent: string;
    risk: string;
    context: string;
    horizon: string | null;
    anchors: {
        label: string;
        verified: boolean;
    }[];
    resolutions: {
        status: "validated" | "partial" | "revised" | "invalidated";
        body: string;
        timestamp: string;
    }[];
    subtype?: string | undefined;
}, {
    type: "vision" | "choice" | "method";
    status: string;
    seal: string;
    intent: string;
    risk: string;
    context: string;
    horizon: string | null;
    anchors: {
        label: string;
        verified: boolean;
    }[];
    resolutions: {
        status: "validated" | "partial" | "revised" | "invalidated";
        body: string;
        timestamp: string;
    }[];
    subtype?: string | undefined;
}>;
export type TimelineEntry = z.infer<typeof timelineEntrySchema>;
export declare const timelineMonthSchema: z.ZodObject<{
    month: z.ZodString;
    entries: z.ZodArray<z.ZodObject<{
        seal: z.ZodString;
        type: z.ZodEnum<["vision", "choice", "method"]>;
        subtype: z.ZodOptional<z.ZodString>;
        context: z.ZodString;
        intent: z.ZodString;
        risk: z.ZodString;
        status: z.ZodString;
        horizon: z.ZodNullable<z.ZodString>;
        anchors: z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            verified: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            label: string;
            verified: boolean;
        }, {
            label: string;
            verified: boolean;
        }>, "many">;
        resolutions: z.ZodArray<z.ZodObject<{
            status: z.ZodEnum<["validated", "partial", "revised", "invalidated"]>;
            body: z.ZodString;
            timestamp: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            status: "validated" | "partial" | "revised" | "invalidated";
            body: string;
            timestamp: string;
        }, {
            status: "validated" | "partial" | "revised" | "invalidated";
            body: string;
            timestamp: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        type: "vision" | "choice" | "method";
        status: string;
        seal: string;
        intent: string;
        risk: string;
        context: string;
        horizon: string | null;
        anchors: {
            label: string;
            verified: boolean;
        }[];
        resolutions: {
            status: "validated" | "partial" | "revised" | "invalidated";
            body: string;
            timestamp: string;
        }[];
        subtype?: string | undefined;
    }, {
        type: "vision" | "choice" | "method";
        status: string;
        seal: string;
        intent: string;
        risk: string;
        context: string;
        horizon: string | null;
        anchors: {
            label: string;
            verified: boolean;
        }[];
        resolutions: {
            status: "validated" | "partial" | "revised" | "invalidated";
            body: string;
            timestamp: string;
        }[];
        subtype?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    entries: {
        type: "vision" | "choice" | "method";
        status: string;
        seal: string;
        intent: string;
        risk: string;
        context: string;
        horizon: string | null;
        anchors: {
            label: string;
            verified: boolean;
        }[];
        resolutions: {
            status: "validated" | "partial" | "revised" | "invalidated";
            body: string;
            timestamp: string;
        }[];
        subtype?: string | undefined;
    }[];
    month: string;
}, {
    entries: {
        type: "vision" | "choice" | "method";
        status: string;
        seal: string;
        intent: string;
        risk: string;
        context: string;
        horizon: string | null;
        anchors: {
            label: string;
            verified: boolean;
        }[];
        resolutions: {
            status: "validated" | "partial" | "revised" | "invalidated";
            body: string;
            timestamp: string;
        }[];
        subtype?: string | undefined;
    }[];
    month: string;
}>;
export type TimelineMonth = z.infer<typeof timelineMonthSchema>;
export declare const handprintProfileSchema: z.ZodObject<{
    version: z.ZodString;
    generatedAt: z.ZodString;
    handle: z.ZodString;
    name: z.ZodString;
    social: z.ZodOptional<z.ZodObject<{
        github: z.ZodOptional<z.ZodObject<{
            url: z.ZodString;
            visibility: z.ZodEnum<["public", "connections", "private"]>;
            verified: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        }, {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        }>>;
        linkedin: z.ZodOptional<z.ZodObject<{
            url: z.ZodString;
            visibility: z.ZodEnum<["public", "connections", "private"]>;
            verified: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        }, {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        }>>;
        website: z.ZodOptional<z.ZodObject<{
            url: z.ZodString;
            visibility: z.ZodEnum<["public", "connections", "private"]>;
            verified: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        }, {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        }>>;
        email: z.ZodOptional<z.ZodObject<{
            url: z.ZodString;
            visibility: z.ZodEnum<["public", "connections", "private"]>;
            verified: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        }, {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        github?: {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        } | undefined;
        linkedin?: {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        } | undefined;
        website?: {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        } | undefined;
        email?: {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        } | undefined;
    }, {
        github?: {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        } | undefined;
        linkedin?: {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        } | undefined;
        website?: {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        } | undefined;
        email?: {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        } | undefined;
    }>>;
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
    calibration: z.ZodObject<{
        score: z.ZodNullable<z.ZodNumber>;
        resolved: z.ZodNumber;
        open: z.ZodNumber;
        breakdown: z.ZodObject<{
            validated: z.ZodNumber;
            partial: z.ZodNumber;
            revised: z.ZodNumber;
            invalidated: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            validated: number;
            partial: number;
            revised: number;
            invalidated: number;
        }, {
            validated: number;
            partial: number;
            revised: number;
            invalidated: number;
        }>;
        formula: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        open: number;
        resolved: number;
        score: number | null;
        breakdown: {
            validated: number;
            partial: number;
            revised: number;
            invalidated: number;
        };
        formula: string;
    }, {
        open: number;
        resolved: number;
        score: number | null;
        breakdown: {
            validated: number;
            partial: number;
            revised: number;
            invalidated: number;
        };
        formula: string;
    }>;
    domains: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        count: z.ZodNumber;
        percentage: z.ZodNumber;
        strong: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        name: string;
        count: number;
        percentage: number;
        strong: boolean;
    }, {
        name: string;
        count: number;
        percentage: number;
        strong: boolean;
    }>, "many">;
    tools: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        count: z.ZodNumber;
        percentage: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        count: number;
        percentage: number;
    }, {
        name: string;
        count: number;
        percentage: number;
    }>, "many">;
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
    firstHandprint: z.ZodString;
    featured: z.ZodNullable<z.ZodObject<{
        hash: z.ZodString;
        strategy: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        hash: string;
        strategy: string;
    }, {
        hash: string;
        strategy: string;
    }>>;
    timeline: z.ZodArray<z.ZodObject<{
        month: z.ZodString;
        entries: z.ZodArray<z.ZodObject<{
            seal: z.ZodString;
            type: z.ZodEnum<["vision", "choice", "method"]>;
            subtype: z.ZodOptional<z.ZodString>;
            context: z.ZodString;
            intent: z.ZodString;
            risk: z.ZodString;
            status: z.ZodString;
            horizon: z.ZodNullable<z.ZodString>;
            anchors: z.ZodArray<z.ZodObject<{
                label: z.ZodString;
                verified: z.ZodBoolean;
            }, "strip", z.ZodTypeAny, {
                label: string;
                verified: boolean;
            }, {
                label: string;
                verified: boolean;
            }>, "many">;
            resolutions: z.ZodArray<z.ZodObject<{
                status: z.ZodEnum<["validated", "partial", "revised", "invalidated"]>;
                body: z.ZodString;
                timestamp: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                status: "validated" | "partial" | "revised" | "invalidated";
                body: string;
                timestamp: string;
            }, {
                status: "validated" | "partial" | "revised" | "invalidated";
                body: string;
                timestamp: string;
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            type: "vision" | "choice" | "method";
            status: string;
            seal: string;
            intent: string;
            risk: string;
            context: string;
            horizon: string | null;
            anchors: {
                label: string;
                verified: boolean;
            }[];
            resolutions: {
                status: "validated" | "partial" | "revised" | "invalidated";
                body: string;
                timestamp: string;
            }[];
            subtype?: string | undefined;
        }, {
            type: "vision" | "choice" | "method";
            status: string;
            seal: string;
            intent: string;
            risk: string;
            context: string;
            horizon: string | null;
            anchors: {
                label: string;
                verified: boolean;
            }[];
            resolutions: {
                status: "validated" | "partial" | "revised" | "invalidated";
                body: string;
                timestamp: string;
            }[];
            subtype?: string | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        entries: {
            type: "vision" | "choice" | "method";
            status: string;
            seal: string;
            intent: string;
            risk: string;
            context: string;
            horizon: string | null;
            anchors: {
                label: string;
                verified: boolean;
            }[];
            resolutions: {
                status: "validated" | "partial" | "revised" | "invalidated";
                body: string;
                timestamp: string;
            }[];
            subtype?: string | undefined;
        }[];
        month: string;
    }, {
        entries: {
            type: "vision" | "choice" | "method";
            status: string;
            seal: string;
            intent: string;
            risk: string;
            context: string;
            horizon: string | null;
            anchors: {
                label: string;
                verified: boolean;
            }[];
            resolutions: {
                status: "validated" | "partial" | "revised" | "invalidated";
                body: string;
                timestamp: string;
            }[];
            subtype?: string | undefined;
        }[];
        month: string;
    }>, "many">;
    repos: z.ZodArray<z.ZodObject<{
        url: z.ZodString;
        handprintCount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        url: string;
        handprintCount: number;
    }, {
        url: string;
        handprintCount: number;
    }>, "many">;
    merkleRoot: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    handle: string;
    version: string;
    generatedAt: string;
    name: string;
    typeCounts: {
        vision: number;
        choice: number;
        method: number;
    };
    total: number;
    calibration: {
        open: number;
        resolved: number;
        score: number | null;
        breakdown: {
            validated: number;
            partial: number;
            revised: number;
            invalidated: number;
        };
        formula: string;
    };
    domains: {
        name: string;
        count: number;
        percentage: number;
        strong: boolean;
    }[];
    tools: {
        name: string;
        count: number;
        percentage: number;
    }[];
    heatmap: {
        date: string;
        count: number;
        level: number;
    }[];
    streak: {
        current: number;
        longest: number;
    };
    firstHandprint: string;
    featured: {
        hash: string;
        strategy: string;
    } | null;
    timeline: {
        entries: {
            type: "vision" | "choice" | "method";
            status: string;
            seal: string;
            intent: string;
            risk: string;
            context: string;
            horizon: string | null;
            anchors: {
                label: string;
                verified: boolean;
            }[];
            resolutions: {
                status: "validated" | "partial" | "revised" | "invalidated";
                body: string;
                timestamp: string;
            }[];
            subtype?: string | undefined;
        }[];
        month: string;
    }[];
    repos: {
        url: string;
        handprintCount: number;
    }[];
    merkleRoot: string | null;
    social?: {
        github?: {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        } | undefined;
        linkedin?: {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        } | undefined;
        website?: {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        } | undefined;
        email?: {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        } | undefined;
    } | undefined;
    subtypeCounts?: Record<string, number> | undefined;
}, {
    handle: string;
    version: string;
    generatedAt: string;
    name: string;
    typeCounts: {
        vision: number;
        choice: number;
        method: number;
    };
    total: number;
    calibration: {
        open: number;
        resolved: number;
        score: number | null;
        breakdown: {
            validated: number;
            partial: number;
            revised: number;
            invalidated: number;
        };
        formula: string;
    };
    domains: {
        name: string;
        count: number;
        percentage: number;
        strong: boolean;
    }[];
    tools: {
        name: string;
        count: number;
        percentage: number;
    }[];
    heatmap: {
        date: string;
        count: number;
        level: number;
    }[];
    streak: {
        current: number;
        longest: number;
    };
    firstHandprint: string;
    featured: {
        hash: string;
        strategy: string;
    } | null;
    timeline: {
        entries: {
            type: "vision" | "choice" | "method";
            status: string;
            seal: string;
            intent: string;
            risk: string;
            context: string;
            horizon: string | null;
            anchors: {
                label: string;
                verified: boolean;
            }[];
            resolutions: {
                status: "validated" | "partial" | "revised" | "invalidated";
                body: string;
                timestamp: string;
            }[];
            subtype?: string | undefined;
        }[];
        month: string;
    }[];
    repos: {
        url: string;
        handprintCount: number;
    }[];
    merkleRoot: string | null;
    social?: {
        github?: {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        } | undefined;
        linkedin?: {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        } | undefined;
        website?: {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        } | undefined;
        email?: {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        } | undefined;
    } | undefined;
    subtypeCounts?: Record<string, number> | undefined;
}>;
export type HandprintProfile = z.infer<typeof handprintProfileSchema>;
export declare const protocolConfigSchema: z.ZodObject<{
    calibration: z.ZodObject<{
        weights: z.ZodObject<{
            validated: z.ZodNumber;
            partial: z.ZodNumber;
            revised: z.ZodNumber;
            invalidated: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            validated: number;
            partial: number;
            revised: number;
            invalidated: number;
        }, {
            validated: number;
            partial: number;
            revised: number;
            invalidated: number;
        }>;
        minResolved: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        weights: {
            validated: number;
            partial: number;
            revised: number;
            invalidated: number;
        };
        minResolved: number;
    }, {
        weights: {
            validated: number;
            partial: number;
            revised: number;
            invalidated: number;
        };
        minResolved: number;
    }>;
    domains: z.ZodObject<{
        strongThreshold: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        strongThreshold: number;
    }, {
        strongThreshold: number;
    }>;
    heatmap: z.ZodObject<{
        weeks: z.ZodNumber;
        levels: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        weeks: number;
        levels: number;
    }, {
        weeks: number;
        levels: number;
    }>;
    featured: z.ZodObject<{
        strategy: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        strategy: string;
    }, {
        strategy: string;
    }>;
    anchors: z.ZodObject<{
        commitWindowBefore: z.ZodString;
        commitWindowAfter: z.ZodString;
        linkPRs: z.ZodBoolean;
        linkRepo: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        commitWindowBefore: string;
        commitWindowAfter: string;
        linkPRs: boolean;
        linkRepo: boolean;
    }, {
        commitWindowBefore: string;
        commitWindowAfter: string;
        linkPRs: boolean;
        linkRepo: boolean;
    }>;
}, "strip", z.ZodTypeAny, {
    anchors: {
        commitWindowBefore: string;
        commitWindowAfter: string;
        linkPRs: boolean;
        linkRepo: boolean;
    };
    calibration: {
        weights: {
            validated: number;
            partial: number;
            revised: number;
            invalidated: number;
        };
        minResolved: number;
    };
    domains: {
        strongThreshold: number;
    };
    heatmap: {
        weeks: number;
        levels: number;
    };
    featured: {
        strategy: string;
    };
}, {
    anchors: {
        commitWindowBefore: string;
        commitWindowAfter: string;
        linkPRs: boolean;
        linkRepo: boolean;
    };
    calibration: {
        weights: {
            validated: number;
            partial: number;
            revised: number;
            invalidated: number;
        };
        minResolved: number;
    };
    domains: {
        strongThreshold: number;
    };
    heatmap: {
        weeks: number;
        levels: number;
    };
    featured: {
        strategy: string;
    };
}>;
export type ProtocolConfig = z.infer<typeof protocolConfigSchema>;
export declare const handprintConfigSchema: z.ZodObject<{
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
            visibility: z.ZodEnum<["public", "connections", "private"]>;
            verified: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        }, {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        }>>;
        linkedin: z.ZodOptional<z.ZodObject<{
            url: z.ZodString;
            visibility: z.ZodEnum<["public", "connections", "private"]>;
            verified: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        }, {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        }>>;
        website: z.ZodOptional<z.ZodObject<{
            url: z.ZodString;
            visibility: z.ZodEnum<["public", "connections", "private"]>;
            verified: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        }, {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        }>>;
        email: z.ZodOptional<z.ZodObject<{
            url: z.ZodString;
            visibility: z.ZodEnum<["public", "connections", "private"]>;
            verified: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        }, {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        github?: {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        } | undefined;
        linkedin?: {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        } | undefined;
        website?: {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        } | undefined;
        email?: {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        } | undefined;
    }, {
        github?: {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        } | undefined;
        linkedin?: {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        } | undefined;
        website?: {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        } | undefined;
        email?: {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        } | undefined;
    }>>;
    remote: z.ZodObject<{
        type: z.ZodString;
        accountId: z.ZodString;
        namespaceId: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: string;
        accountId: string;
        namespaceId: string | null;
    }, {
        type: string;
        accountId: string;
        namespaceId: string | null;
    }>;
    protocol: z.ZodObject<{
        calibration: z.ZodObject<{
            weights: z.ZodObject<{
                validated: z.ZodNumber;
                partial: z.ZodNumber;
                revised: z.ZodNumber;
                invalidated: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                validated: number;
                partial: number;
                revised: number;
                invalidated: number;
            }, {
                validated: number;
                partial: number;
                revised: number;
                invalidated: number;
            }>;
            minResolved: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            weights: {
                validated: number;
                partial: number;
                revised: number;
                invalidated: number;
            };
            minResolved: number;
        }, {
            weights: {
                validated: number;
                partial: number;
                revised: number;
                invalidated: number;
            };
            minResolved: number;
        }>;
        domains: z.ZodObject<{
            strongThreshold: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            strongThreshold: number;
        }, {
            strongThreshold: number;
        }>;
        heatmap: z.ZodObject<{
            weeks: z.ZodNumber;
            levels: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            weeks: number;
            levels: number;
        }, {
            weeks: number;
            levels: number;
        }>;
        featured: z.ZodObject<{
            strategy: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            strategy: string;
        }, {
            strategy: string;
        }>;
        anchors: z.ZodObject<{
            commitWindowBefore: z.ZodString;
            commitWindowAfter: z.ZodString;
            linkPRs: z.ZodBoolean;
            linkRepo: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            commitWindowBefore: string;
            commitWindowAfter: string;
            linkPRs: boolean;
            linkRepo: boolean;
        }, {
            commitWindowBefore: string;
            commitWindowAfter: string;
            linkPRs: boolean;
            linkRepo: boolean;
        }>;
    }, "strip", z.ZodTypeAny, {
        anchors: {
            commitWindowBefore: string;
            commitWindowAfter: string;
            linkPRs: boolean;
            linkRepo: boolean;
        };
        calibration: {
            weights: {
                validated: number;
                partial: number;
                revised: number;
                invalidated: number;
            };
            minResolved: number;
        };
        domains: {
            strongThreshold: number;
        };
        heatmap: {
            weeks: number;
            levels: number;
        };
        featured: {
            strategy: string;
        };
    }, {
        anchors: {
            commitWindowBefore: string;
            commitWindowAfter: string;
            linkPRs: boolean;
            linkRepo: boolean;
        };
        calibration: {
            weights: {
                validated: number;
                partial: number;
                revised: number;
                invalidated: number;
            };
            minResolved: number;
        };
        domains: {
            strongThreshold: number;
        };
        heatmap: {
            weeks: number;
            levels: number;
        };
        featured: {
            strategy: string;
        };
    }>;
}, "strip", z.ZodTypeAny, {
    version: string;
    createdAt: string;
    identity: {
        handle: string;
        email: string;
        name: string;
    };
    remote: {
        type: string;
        accountId: string;
        namespaceId: string | null;
    };
    protocol: {
        anchors: {
            commitWindowBefore: string;
            commitWindowAfter: string;
            linkPRs: boolean;
            linkRepo: boolean;
        };
        calibration: {
            weights: {
                validated: number;
                partial: number;
                revised: number;
                invalidated: number;
            };
            minResolved: number;
        };
        domains: {
            strongThreshold: number;
        };
        heatmap: {
            weeks: number;
            levels: number;
        };
        featured: {
            strategy: string;
        };
    };
    social?: {
        github?: {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        } | undefined;
        linkedin?: {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        } | undefined;
        website?: {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        } | undefined;
        email?: {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        } | undefined;
    } | undefined;
}, {
    version: string;
    createdAt: string;
    identity: {
        handle: string;
        email: string;
        name: string;
    };
    remote: {
        type: string;
        accountId: string;
        namespaceId: string | null;
    };
    protocol: {
        anchors: {
            commitWindowBefore: string;
            commitWindowAfter: string;
            linkPRs: boolean;
            linkRepo: boolean;
        };
        calibration: {
            weights: {
                validated: number;
                partial: number;
                revised: number;
                invalidated: number;
            };
            minResolved: number;
        };
        domains: {
            strongThreshold: number;
        };
        heatmap: {
            weeks: number;
            levels: number;
        };
        featured: {
            strategy: string;
        };
    };
    social?: {
        github?: {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        } | undefined;
        linkedin?: {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        } | undefined;
        website?: {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        } | undefined;
        email?: {
            url: string;
            visibility: "public" | "connections" | "private";
            verified?: boolean | undefined;
        } | undefined;
    } | undefined;
}>;
export type HandprintConfig = z.infer<typeof handprintConfigSchema>;
