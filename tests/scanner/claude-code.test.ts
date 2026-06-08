import { describe, it, expect } from "vitest";
import {
  parseTranscriptLine,
  extractConversationPairs,
  classifyPair,
} from "../../src/scanner/claude-code.js";
import type { TranscriptEntry } from "../../src/scanner/claude-code.js";

describe("Claude Code transcript scanner", () => {
  describe("parseTranscriptLine", () => {
    it("parses a user message line", () => {
      const line = JSON.stringify({
        type: "user",
        message: {
          role: "user",
          content: "use edge JWT instead of the gateway",
        },
        timestamp: "2026-06-01T10:00:00Z",
        cwd: "/Users/test/project",
        sessionId: "abc-123",
        gitBranch: "main",
      });
      const entry = parseTranscriptLine(line);
      expect(entry).not.toBeNull();
      expect(entry!.role).toBe("user");
      expect(entry!.text).toContain("edge JWT");
    });

    it("parses user message with array content", () => {
      const line = JSON.stringify({
        type: "user",
        message: {
          role: "user",
          content: [
            { type: "text", text: "use edge JWT" },
            { type: "text", text: " instead of the gateway" },
          ],
        },
        timestamp: "2026-06-01T10:00:00Z",
        cwd: "/Users/test/project",
        sessionId: "abc-123",
      });
      const entry = parseTranscriptLine(line);
      expect(entry).not.toBeNull();
      expect(entry!.text).toBe("use edge JWT instead of the gateway");
    });

    it("parses an assistant message line", () => {
      const line = JSON.stringify({
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            {
              type: "text",
              text: "I'll implement the edge JWT approach.",
            },
          ],
        },
        timestamp: "2026-06-01T10:00:01Z",
        cwd: "/Users/test/project",
        sessionId: "abc-123",
      });
      const entry = parseTranscriptLine(line);
      expect(entry).not.toBeNull();
      expect(entry!.role).toBe("assistant");
      expect(entry!.text).toContain("edge JWT");
    });

    it("parses assistant message with string content", () => {
      const line = JSON.stringify({
        type: "assistant",
        message: {
          role: "assistant",
          content: "I'll implement the edge JWT approach.",
        },
        timestamp: "2026-06-01T10:00:01Z",
        cwd: "/Users/test/project",
        sessionId: "abc-123",
      });
      const entry = parseTranscriptLine(line);
      expect(entry).not.toBeNull();
      expect(entry!.role).toBe("assistant");
      expect(entry!.text).toContain("edge JWT");
    });

    it("returns null for non-message types", () => {
      const line = JSON.stringify({ type: "mode", mode: "normal" });
      expect(parseTranscriptLine(line)).toBeNull();
    });

    it("returns null for invalid JSON", () => {
      expect(parseTranscriptLine("not json")).toBeNull();
    });

    it("returns null for tool_result content items", () => {
      const line = JSON.stringify({
        type: "user",
        message: {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: "x", content: "" }],
        },
        timestamp: "2026-06-01T10:00:00Z",
        cwd: "/Users/test/project",
        sessionId: "abc-123",
      });
      expect(parseTranscriptLine(line)).toBeNull();
    });
  });

  describe("extractConversationPairs", () => {
    it("pairs user messages with following assistant messages", () => {
      const entries: TranscriptEntry[] = [
        {
          role: "user",
          text: "do X instead of Y",
          timestamp: "t1",
          cwd: "/test",
          sessionId: "s1",
          gitBranch: "",
        },
        {
          role: "assistant",
          text: "OK, implementing X.",
          timestamp: "t2",
          cwd: "/test",
          sessionId: "s1",
          gitBranch: "",
        },
        {
          role: "user",
          text: "never use vendor auth",
          timestamp: "t3",
          cwd: "/test",
          sessionId: "s1",
          gitBranch: "",
        },
        {
          role: "assistant",
          text: "Understood, adding constraint.",
          timestamp: "t4",
          cwd: "/test",
          sessionId: "s1",
          gitBranch: "",
        },
      ];
      const pairs = extractConversationPairs(entries);
      expect(pairs).toHaveLength(2);
      expect(pairs[0].user.text).toContain("do X");
      expect(pairs[0].assistant.text).toContain("implementing X");
    });

    it("skips unpaired user messages", () => {
      const entries: TranscriptEntry[] = [
        {
          role: "user",
          text: "first",
          timestamp: "t1",
          cwd: "/test",
          sessionId: "s1",
          gitBranch: "",
        },
        {
          role: "user",
          text: "second",
          timestamp: "t2",
          cwd: "/test",
          sessionId: "s1",
          gitBranch: "",
        },
        {
          role: "assistant",
          text: "response to second",
          timestamp: "t3",
          cwd: "/test",
          sessionId: "s1",
          gitBranch: "",
        },
      ];
      const pairs = extractConversationPairs(entries);
      expect(pairs).toHaveLength(1);
      expect(pairs[0].user.text).toBe("second");
    });

    it("returns empty for empty input", () => {
      expect(extractConversationPairs([])).toEqual([]);
    });
  });

  describe("classifyPair", () => {
    it("detects override when user chooses an alternative", () => {
      const result = classifyPair({
        user: {
          role: "user",
          text: "no, use edge JWT instead of the centralized gateway",
          timestamp: "t",
          cwd: "/c",
          sessionId: "s",
          gitBranch: "",
        },
        assistant: {
          role: "assistant",
          text: "Switching to edge JWT approach.",
          timestamp: "t",
          cwd: "/c",
          sessionId: "s",
          gitBranch: "",
        },
      });
      expect(result).not.toBeNull();
      expect(result!.suggestedType).toBe("override");
    });

    it("detects rejection when user declines", () => {
      const result = classifyPair({
        user: {
          role: "user",
          text: "we're not building the recommendations engine, skip that",
          timestamp: "t",
          cwd: "/c",
          sessionId: "s",
          gitBranch: "",
        },
        assistant: {
          role: "assistant",
          text: "OK, removing recs engine.",
          timestamp: "t",
          cwd: "/c",
          sessionId: "s",
          gitBranch: "",
        },
      });
      expect(result).not.toBeNull();
      expect(result!.suggestedType).toBe("rejection");
    });

    it("detects constraint signals", () => {
      const result = classifyPair({
        user: {
          role: "user",
          text: "never use vendor auth in this project",
          timestamp: "t",
          cwd: "/c",
          sessionId: "s",
          gitBranch: "",
        },
        assistant: {
          role: "assistant",
          text: "Got it, will avoid vendor auth.",
          timestamp: "t",
          cwd: "/c",
          sessionId: "s",
          gitBranch: "",
        },
      });
      expect(result).not.toBeNull();
      expect(result!.suggestedType).toBe("constraint");
    });

    it("detects wager signals", () => {
      const result = classifyPair({
        user: {
          role: "user",
          text: "I bet serverless will dominate within 12 months",
          timestamp: "t",
          cwd: "/c",
          sessionId: "s",
          gitBranch: "",
        },
        assistant: {
          role: "assistant",
          text: "Interesting prediction.",
          timestamp: "t",
          cwd: "/c",
          sessionId: "s",
          gitBranch: "",
        },
      });
      expect(result).not.toBeNull();
      expect(result!.suggestedType).toBe("wager");
    });

    it("returns null for routine exchanges", () => {
      const result = classifyPair({
        user: {
          role: "user",
          text: "format the code",
          timestamp: "t",
          cwd: "/c",
          sessionId: "s",
          gitBranch: "",
        },
        assistant: {
          role: "assistant",
          text: "Done, formatted.",
          timestamp: "t",
          cwd: "/c",
          sessionId: "s",
          gitBranch: "",
        },
      });
      expect(result).toBeNull();
    });
  });
});
