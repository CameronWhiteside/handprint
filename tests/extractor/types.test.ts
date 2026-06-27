// tests/extractor/types.test.ts
import { describe, it, expect } from 'vitest';
import { parseExtractionJson, SYSTEM_PROMPT } from '../../src/extractor/types.js';

describe('parseExtractionJson', () => {
  it('parses valid marks and drops invalid ones', () => {
    const text = 'noise before [{"marks":[{"type":"choice","subtype":"override","note":"chose edge JWT"},{"type":"bogus"}],"artifacts":[],"timestamp":"2026-06-01T10:00:00Z"}] noise after';
    const out = parseExtractionJson(text);
    expect(out).toHaveLength(1);
    expect(out[0].marks).toHaveLength(1);
    expect(out[0].marks[0].note).toBe('chose edge JWT');
  });

  it('drops extractions with zero valid marks', () => {
    const text = '[{"marks":[{"type":"bogus"}],"artifacts":[],"timestamp":"t"}]';
    expect(parseExtractionJson(text)).toHaveLength(0);
  });

  it('returns [] when no array present', () => {
    expect(parseExtractionJson('sorry, nothing here')).toEqual([]);
  });

  it('exposes a non-empty system prompt', () => {
    expect(SYSTEM_PROMPT).toContain('handprint');
  });
});
