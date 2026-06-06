import { describe, it, expect } from "vitest";
import { DEFAULT_PROTOCOL, type ProtocolConfig } from "../../src/profile/types.js";

describe("DEFAULT_PROTOCOL", () => {
  it("has calibration weights summing validated=1, partial=0.5, revised=0.25, invalidated=0", () => {
    expect(DEFAULT_PROTOCOL.calibration.weights).toEqual({
      validated: 1.0,
      partial: 0.5,
      revised: 0.25,
      invalidated: 0.0,
    });
  });

  it("requires minimum 5 resolved handprints for calibration", () => {
    expect(DEFAULT_PROTOCOL.calibration.minResolved).toBe(5);
  });

  it("uses 10% threshold for strong domains", () => {
    expect(DEFAULT_PROTOCOL.domains.strongThreshold).toBe(0.10);
  });

  it("configures heatmap for 52 weeks with 5 levels", () => {
    expect(DEFAULT_PROTOCOL.heatmap).toEqual({ weeks: 52, levels: 5 });
  });

  it("uses most-anchors strategy for featured handprint", () => {
    expect(DEFAULT_PROTOCOL.featured.strategy).toBe("most-anchors");
  });

  it("defines anchor commit windows and linking", () => {
    expect(DEFAULT_PROTOCOL.anchors).toEqual({
      commitWindowBefore: "PT30M",
      commitWindowAfter: "PT60M",
      linkPRs: true,
      linkRepo: true,
    });
  });

  it("satisfies the ProtocolConfig type", () => {
    const config: ProtocolConfig = DEFAULT_PROTOCOL;
    expect(config).toBeDefined();
  });
});
