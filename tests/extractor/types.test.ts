// tests/extractor/types.test.ts
import { describe, it, expect } from 'vitest';
import { parseExtractionJson } from '../../src/extractor/types.js';

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

  it('balanced scanner picks the first complete array ignoring trailing text', () => {
    // Old greedy regex would grab everything from first '[' to last ']',
    // producing invalid JSON that includes "trailing [docs]".
    // The balanced scanner stops at the first closed bracket pair.
    const text = 'prefix [tag] {note} [{"marks":[{"type":"choice","subtype":"override","note":"chose X"}],"artifacts":[],"timestamp":"t"}] trailing [docs]';
    const out = parseExtractionJson(text);
    expect(out).toHaveLength(1);
    expect(out[0].marks[0].note).toBe('chose X');
  });
});

// Item 11: note-length salvage
describe('parseExtractionJson note-length salvage', () => {
  it('keeps a mark whose note exceeds MARK_NOTE_MAX by truncating to the max', () => {
    const longNote = 'x'.repeat(400); // 400 > MARK_NOTE_MAX (280)
    const text = JSON.stringify([{
      marks: [{ type: 'choice', subtype: 'override', note: longNote }],
      artifacts: [],
      timestamp: '2026-06-01T10:00:00Z',
    }]);
    const out = parseExtractionJson(text);
    expect(out).toHaveLength(1);
    expect(out[0].marks).toHaveLength(1);
    expect(out[0].marks[0].note.length).toBe(280);
    expect(out[0].marks[0].note).toBe(longNote.slice(0, 280));
  });

  it('still drops marks with a genuinely invalid enum (bad type), not just a long note', () => {
    const text = JSON.stringify([{
      marks: [{ type: 'bogus', subtype: 'override', note: 'short' }],
      artifacts: [],
      timestamp: '2026-06-01T10:00:00Z',
    }]);
    expect(parseExtractionJson(text)).toHaveLength(0);
  });
});

// Item 3: requireLeadingArray option
describe('parseExtractionJson requireLeadingArray', () => {
  it('returns [] when text has leading prose and requireLeadingArray is true', () => {
    const text = 'Based on review [{"marks":[{"type":"choice","subtype":"approval","note":"ok"}],"artifacts":[],"timestamp":"2026-06-01T10:00:00Z"}]';
    expect(parseExtractionJson(text, { requireLeadingArray: true })).toEqual([]);
  });

  it('parses normally when text starts directly with [ and requireLeadingArray is true', () => {
    const text = '[{"marks":[{"type":"choice","subtype":"approval","note":"approved it"}],"artifacts":[],"timestamp":"2026-06-01T10:00:00Z"}]';
    const out = parseExtractionJson(text, { requireLeadingArray: true });
    expect(out).toHaveLength(1);
    expect(out[0].marks[0].note).toBe('approved it');
  });

  it('still scans for embedded arrays when requireLeadingArray is false (default)', () => {
    const text = 'Some prose [{"marks":[{"type":"choice","subtype":"approval","note":"embedded"}],"artifacts":[],"timestamp":"2026-06-01T10:00:00Z"}]';
    const out = parseExtractionJson(text);
    expect(out).toHaveLength(1);
  });

  it('trims leading whitespace when checking for [', () => {
    const text = '   [{"marks":[{"type":"choice","subtype":"approval","note":"ws ok"}],"artifacts":[],"timestamp":"2026-06-01T10:00:00Z"}]';
    const out = parseExtractionJson(text, { requireLeadingArray: true });
    expect(out).toHaveLength(1);
  });
});

// Item 4: ISO-8601 timestamp validation
describe('parseExtractionJson timestamp validation', () => {
  it('rejects SQL-injection-style timestamp and falls back to valid ISO string', () => {
    const text = '[{"marks":[{"type":"choice","subtype":"approval","note":"safe"}],"artifacts":[],"timestamp":"; DROP TABLE x"}]';
    const out = parseExtractionJson(text);
    expect(out).toHaveLength(1);
    const ts = out[0].timestamp;
    // Must be a valid ISO-8601 datetime, not the attacker string.
    expect(ts).not.toBe('; DROP TABLE x');
    expect(/^\d{4}-\d{2}-\d{2}T/.test(ts)).toBe(true);
    expect(Number.isNaN(Date.parse(ts))).toBe(false);
  });

  it('accepts a valid ISO-8601 timestamp unchanged', () => {
    const text = '[{"marks":[{"type":"choice","subtype":"approval","note":"ok"}],"artifacts":[],"timestamp":"2026-06-01T10:00:00Z"}]';
    const out = parseExtractionJson(text);
    expect(out[0].timestamp).toBe('2026-06-01T10:00:00Z');
  });

  it('rejects a bare date string (no T) and falls back', () => {
    const text = '[{"marks":[{"type":"choice","subtype":"approval","note":"ok"}],"artifacts":[],"timestamp":"2026-06-01"}]';
    const out = parseExtractionJson(text);
    // '2026-06-01' does not match /^\d{4}-\d{2}-\d{2}T/ so should fall back.
    expect(out[0].timestamp).not.toBe('2026-06-01');
    expect(/^\d{4}-\d{2}-\d{2}T/.test(out[0].timestamp)).toBe(true);
  });
});
