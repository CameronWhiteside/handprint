import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  HandprintType,
  createHandprint,
  validateHandprint,
} from "../../src/model/handprint.js";
import type { Handprint } from "../../src/model/handprint.js";

describe("HandprintType enum", () => {
  it("defines all five values", () => {
    expect(HandprintType.Direction).toBe("direction");
    expect(HandprintType.Override).toBe("override");
    expect(HandprintType.Rejection).toBe("rejection");
    expect(HandprintType.Constraint).toBe("constraint");
    expect(HandprintType.Wager).toBe("wager");
  });
});

describe("createHandprint", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds a valid record with defaults", () => {
    const hp = createHandprint({
      type: HandprintType.Direction,
      intent: "Chose React over Vue",
      risk: "Lock-in to JSX ecosystem",
      context: "Frontend framework selection for v2",
    });

    expect(hp.type).toBe(HandprintType.Direction);
    expect(hp.intent).toBe("Chose React over Vue");
    expect(hp.risk).toBe("Lock-in to JSX ecosystem");
    expect(hp.context).toBe("Frontend framework selection for v2");
    expect(hp.timestamp).toBe("2025-01-15T12:00:00.000Z");
    expect(typeof hp.author).toBe("string");
    expect(hp.horizon).toBeNull();
    expect(hp.confidence).toBeNull();
    expect(hp.source).toBeNull();
    expect(hp.anchors).toEqual([]);
    expect(hp.status).toBe("open");
    expect(hp.parent).toBeNull();
  });

  it("sets parent to null by default", () => {
    const hp = createHandprint({
      type: HandprintType.Direction,
      intent: "Test parent default",
      risk: "None",
      context: "Testing",
    });
    expect(hp.parent).toBeNull();
  });

  it("accepts an explicit parent hash", () => {
    const hp = createHandprint({
      type: HandprintType.Direction,
      intent: "Test explicit parent",
      risk: "None",
      context: "Testing",
      parent: "abc123def456",
    });
    expect(hp.parent).toBe("abc123def456");
  });

  it("accepts optional fields", () => {
    const hp = createHandprint({
      type: HandprintType.Wager,
      intent: "Bet on serverless",
      risk: "Cold start latency",
      context: "Infrastructure decision",
      horizon: "2025-06-01",
      confidence: 0.8,
      source: "CTO review",
      anchors: [{ label: "arch-doc.md", verified: true }],
      author: "Alice <alice@example.com>",
    });

    expect(hp.horizon).toBe("2025-06-01");
    expect(hp.confidence).toBe(0.8);
    expect(hp.source).toBe("CTO review");
    expect(hp.anchors).toEqual([{ label: "arch-doc.md", verified: true }]);
    expect(hp.author).toBe("Alice <alice@example.com>");
    expect(hp.status).toBe("open");
  });
});

describe("validateHandprint", () => {
  const validHandprint: Handprint = {
    type: HandprintType.Direction,
    intent: "Chose React",
    risk: "Lock-in",
    context: "Framework selection",
    timestamp: "2025-01-15T12:00:00.000Z",
    author: "Test User",
    horizon: null,
    confidence: null,
    source: null,
    anchors: [],
    status: "open",
    parent: null,
  };

  it("returns empty array for valid handprint", () => {
    expect(validateHandprint(validHandprint)).toEqual([]);
  });

  it("returns errors for missing required fields", () => {
    const errors = validateHandprint({
      ...validHandprint,
      intent: "",
      risk: "",
      context: "",
      timestamp: "",
    });
    expect(errors.length).toBeGreaterThanOrEqual(4);
    expect(errors.some((e) => e.includes("intent"))).toBe(true);
    expect(errors.some((e) => e.includes("risk"))).toBe(true);
    expect(errors.some((e) => e.includes("context"))).toBe(true);
    expect(errors.some((e) => e.includes("timestamp"))).toBe(true);
  });

  it("returns errors for invalid type", () => {
    const errors = validateHandprint({
      ...validHandprint,
      type: "invalid" as HandprintType,
    });
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors.some((e) => e.includes("type"))).toBe(true);
  });

  it("returns empty array for valid handprint with all fields", () => {
    const full: Handprint = {
      ...validHandprint,
      horizon: "2025-06-01",
      confidence: 0.9,
      source: "review",
      anchors: [{ label: "file.ts", verified: false }],
    };
    expect(validateHandprint(full)).toEqual([]);
  });
});
