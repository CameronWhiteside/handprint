export interface HandprintProfile {
  version: string;
  generatedAt: string;
  handle: string;
  name: string;

  typeCounts: {
    vision: number;
    choice: number;
    method: number;
  };
  total: number;

  calibration: {
    score: number | null;
    resolved: number;
    open: number;
    breakdown: {
      validated: number;
      partial: number;
      revised: number;
      invalidated: number;
    };
    formula: string;
  };

  domains: Array<{
    name: string;
    count: number;
    percentage: number;
    strong: boolean;
  }>;

  tools: Array<{
    name: string;
    count: number;
    percentage: number;
  }>;

  heatmap: Array<{
    date: string;
    count: number;
    level: number;
  }>;

  streak: {
    current: number;
    longest: number;
  };

  firstHandprint: string;

  featured: {
    hash: string;
    strategy: string;
  } | null;

  timeline: Array<{
    month: string;
    entries: Array<{
      hash: string;
      day: string;
      time: string;
      type: string;
      context: string;
      intent: string;
      risk: string;
      status: string;
      statusLabel: string;
      horizon: string | null;
      anchors: Array<{ label: string; verified: boolean }>;
      resolutions: Array<{
        status: string;
        body: string;
        timestamp: string;
      }>;
    }>;
  }>;

  repos: Array<{
    url: string;
    handprintCount: number;
  }>;

  merkleRoot: string | null;
}

export interface ProtocolConfig {
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
  anchors: {
    commitWindowBefore: string;
    commitWindowAfter: string;
    linkPRs: boolean;
    linkRepo: boolean;
  };
}

export interface HandprintConfig {
  version: string;
  createdAt: string;
  identity: {
    handle: string;
    name: string;
    email: string;
  };
  remote: {
    type: string;
    accountId: string;
    namespaceId: string | null;
  };
  protocol: ProtocolConfig;
}

export const DEFAULT_PROTOCOL: ProtocolConfig = {
  calibration: {
    weights: { validated: 1.0, partial: 0.5, revised: 0.25, invalidated: 0.0 },
    minResolved: 5,
  },
  domains: { strongThreshold: 0.10 },
  heatmap: { weeks: 52, levels: 5 },
  featured: { strategy: "most-anchors" },
  anchors: {
    commitWindowBefore: "PT30M",
    commitWindowAfter: "PT60M",
    linkPRs: true,
    linkRepo: true,
  },
};
