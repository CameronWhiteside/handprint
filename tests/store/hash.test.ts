import { describe, it, expect } from "vitest";
import { hashObject } from "../../src/store/hash.js";

describe("hashObject", () => {
  it("returns a 64-char hex string", () => {
    const hash = hashObject({ foo: "bar" });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces the same hash regardless of key order", () => {
    const hash1 = hashObject({ a: 1, b: 2, c: 3 });
    const hash2 = hashObject({ c: 3, a: 1, b: 2 });
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different content", () => {
    const hash1 = hashObject({ foo: "bar" });
    const hash2 = hashObject({ foo: "baz" });
    expect(hash1).not.toBe(hash2);
  });

  it("handles nested objects with deterministic key ordering", () => {
    const hash1 = hashObject({ outer: { b: 2, a: 1 } });
    const hash2 = hashObject({ outer: { a: 1, b: 2 } });
    expect(hash1).toBe(hash2);
  });
});
