import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ResolutionStatus,
  createResolution,
  validateResolution,
} from "../../src/model/resolution.js";
import type { Resolution } from "../../src/model/resolution.js";

describe("ResolutionStatus enum", () => {
  it("defines all four values", () => {
    expect(ResolutionStatus.Validated).toBe("validated");
    expect(ResolutionStatus.Partial).toBe("partial");
    expect(ResolutionStatus.Revised).toBe("revised");
    expect(ResolutionStatus.Invalidated).toBe("invalidated");
  });
});

describe("createResolution", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-02-20T15:30:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds a valid record with defaults", () => {
    const res = createResolution({
      handprintHash: "abc123def456",
      status: ResolutionStatus.Validated,
      body: "Decision proved correct after 3 months",
    });

    expect(res.handprintHash).toBe("abc123def456");
    expect(res.status).toBe(ResolutionStatus.Validated);
    expect(res.body).toBe("Decision proved correct after 3 months");
    expect(res.learnings).toEqual([]);
    expect(res.timestamp).toBe("2025-02-20T15:30:00.000Z");
    expect(res.author).toBe("unknown");
  });

  it("accepts optional fields", () => {
    const res = createResolution({
      handprintHash: "abc123def456",
      status: ResolutionStatus.Partial,
      body: "Partially validated",
      learnings: ["Need more testing", "Consider alternatives"],
      author: "Bob <bob@example.com>",
    });

    expect(res.learnings).toEqual([
      "Need more testing",
      "Consider alternatives",
    ]);
    expect(res.author).toBe("Bob <bob@example.com>");
  });
});

describe("validateResolution", () => {
  const validResolution: Resolution = {
    handprintHash: "abc123def456",
    status: ResolutionStatus.Validated,
    body: "Decision validated",
    learnings: [],
    timestamp: "2025-02-20T15:30:00.000Z",
    author: "Test User",
  };

  it("returns empty array for valid resolution", () => {
    expect(validateResolution(validResolution)).toEqual([]);
  });

  it("returns errors for missing required fields", () => {
    const errors = validateResolution({
      ...validResolution,
      handprintHash: "",
      body: "",
    });
    expect(errors.length).toBeGreaterThanOrEqual(2);
    expect(errors.some((e) => e.includes("handprintHash"))).toBe(true);
    expect(errors.some((e) => e.includes("body"))).toBe(true);
  });

  it("returns errors for invalid status", () => {
    const errors = validateResolution({
      ...validResolution,
      status: "bogus" as ResolutionStatus,
    });
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors.some((e) => e.includes("status"))).toBe(true);
  });

  it("returns empty array for valid resolution with learnings", () => {
    const full: Resolution = {
      ...validResolution,
      learnings: ["Lesson learned"],
    };
    expect(validateResolution(full)).toEqual([]);
  });
});
