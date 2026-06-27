import { describe, it, expect } from 'vitest';
import {
  markSchema,
  artifactSchema,
  sourceSchema,
  handprintObjectSchema,
  HANDPRINT_TYPES,
  ALL_SUBTYPES,
  ARTIFACT_TYPES,
  VISION_SUBTYPES,
  CHOICE_SUBTYPES,
  METHOD_SUBTYPES,
  SUBTYPES_BY_TYPE,
  subtypeSchemaForType,
  MARK_NOTE_MAX,
} from '../handprint.js';

// ── Mark schemas ────────────────────────────────────────────────

describe('markSchema', () => {
  it('accepts a valid vision mark', () => {
    const result = markSchema.safeParse({
      type: 'vision',
      subtype: 'goal',
      note: 'build a CLI tool',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid choice mark', () => {
    const result = markSchema.safeParse({
      type: 'choice',
      subtype: 'override',
      note: 'chose Drizzle over raw SQL',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid method mark', () => {
    const result = markSchema.safeParse({
      type: 'method',
      subtype: 'tool',
      note: 'Ed25519 for signing',
    });
    expect(result.success).toBe(true);
  });

  it('rejects wrong subtype for type (vision with tool)', () => {
    const result = markSchema.safeParse({
      type: 'vision',
      subtype: 'tool',
      note: 'some note',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty note', () => {
    const result = markSchema.safeParse({
      type: 'vision',
      subtype: 'goal',
      note: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a note over 280 chars', () => {
    const result = markSchema.safeParse({
      type: 'vision',
      subtype: 'goal',
      note: 'x'.repeat(MARK_NOTE_MAX + 1),
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing subtype', () => {
    const result = markSchema.safeParse({
      type: 'vision',
      note: 'some note',
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown type', () => {
    const result = markSchema.safeParse({
      type: 'unknown',
      subtype: 'goal',
      note: 'some note',
    });
    expect(result.success).toBe(false);
  });
});

// ── Artifact schema ─────────────────────────────────────────────

describe('artifactSchema', () => {
  it('accepts a valid git-commit artifact', () => {
    const result = artifactSchema.safeParse({
      type: 'git-commit',
      uri: 'git://repo@abc',
      hash: 'sha256:abcdef1234567890',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid url artifact with parent', () => {
    const result = artifactSchema.safeParse({
      type: 'url',
      uri: 'https://example.com',
      parent: 'git://repo',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty uri', () => {
    const result = artifactSchema.safeParse({
      type: 'git-commit',
      uri: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown artifact type', () => {
    const result = artifactSchema.safeParse({
      type: 'foobar',
      uri: 'https://example.com',
    });
    expect(result.success).toBe(false);
  });

  it('accepts an artifact without hash (optional)', () => {
    const result = artifactSchema.safeParse({
      type: 'file',
      uri: 'file:///path/to/file',
    });
    expect(result.success).toBe(true);
  });

  // Item 5: URI scheme guard
  it('rejects javascript: URI scheme', () => {
    const result = artifactSchema.safeParse({ type: 'url', uri: 'javascript:alert(1)' });
    expect(result.success).toBe(false);
  });

  it('rejects data: URI scheme', () => {
    const result = artifactSchema.safeParse({ type: 'url', uri: 'data:text/html,<h1>xss</h1>' });
    expect(result.success).toBe(false);
  });

  it('accepts https: URI scheme', () => {
    const result = artifactSchema.safeParse({ type: 'url', uri: 'https://example.com/repo' });
    expect(result.success).toBe(true);
  });

  it('accepts http: URI scheme', () => {
    const result = artifactSchema.safeParse({ type: 'url', uri: 'http://internal.host/path' });
    expect(result.success).toBe(true);
  });

  it('accepts git: URI scheme', () => {
    const result = artifactSchema.safeParse({ type: 'git-repo', uri: 'git://github.com/owner/repo' });
    expect(result.success).toBe(true);
  });

  it('accepts ssh: URI scheme', () => {
    const result = artifactSchema.safeParse({ type: 'git-repo', uri: 'ssh://git@github.com/owner/repo.git' });
    expect(result.success).toBe(true);
  });

  it('accepts scheme-less relative path (no URL scheme)', () => {
    const result = artifactSchema.safeParse({ type: 'file', uri: 'src/index.ts' });
    expect(result.success).toBe(true);
  });

  it('accepts scheme-less git ref', () => {
    const result = artifactSchema.safeParse({ type: 'git-commit', uri: 'abc1234def5678' });
    expect(result.success).toBe(true);
  });
});

// ── Source schema ───────────────────────────────────────────────

describe('sourceSchema', () => {
  it('accepts a full source', () => {
    const result = sourceSchema.safeParse({
      agent: 'claude-code/opus-4-8',
      extractor: 'claude-haiku-4-5',
      session: 'abc',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a minimal source (agent only)', () => {
    const result = sourceSchema.safeParse({
      agent: 'lovable/v2',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing agent', () => {
    const result = sourceSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects empty agent', () => {
    const result = sourceSchema.safeParse({ agent: '' });
    expect(result.success).toBe(false);
  });
});

// ── HandprintObject schema ──────────────────────────────────────

describe('handprintObjectSchema', () => {
  const validHandprint = {
    v: 1,
    ts: '2026-06-26T00:00:00Z',
    marks: [{ type: 'vision', subtype: 'goal', note: 'build a CLI tool' }],
    artifacts: [{ type: 'git-commit', uri: 'git://repo@abc' }],
    source: { agent: 'claude-code/opus-4-8' },
    payload: 'encrypted-payload-data',
    parent: 'sha256:parent-hash',
    sig: 'sig-value',
    pubkey: 'pubkey-value',
  };

  it('accepts a valid complete handprint object', () => {
    const result = handprintObjectSchema.safeParse(validHandprint);
    expect(result.success).toBe(true);
  });

  it('accepts parent=null (genesis)', () => {
    const result = handprintObjectSchema.safeParse({
      ...validHandprint,
      parent: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty artifacts array', () => {
    const result = handprintObjectSchema.safeParse({
      ...validHandprint,
      artifacts: [],
    });
    expect(result.success).toBe(true);
  });

  it('rejects v !== 1', () => {
    const result = handprintObjectSchema.safeParse({
      ...validHandprint,
      v: 2,
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty marks array', () => {
    const result = handprintObjectSchema.safeParse({
      ...validHandprint,
      marks: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing sig', () => {
    const { sig, ...noSig } = validHandprint;
    const result = handprintObjectSchema.safeParse(noSig);
    expect(result.success).toBe(false);
  });

  it('rejects missing pubkey', () => {
    const { pubkey, ...noPubkey } = validHandprint;
    const result = handprintObjectSchema.safeParse(noPubkey);
    expect(result.success).toBe(false);
  });
});

// ── Constants ───────────────────────────────────────────────────

describe('constants', () => {
  it('HANDPRINT_TYPES has exactly 3 entries', () => {
    expect(HANDPRINT_TYPES).toHaveLength(3);
  });

  it('ALL_SUBTYPES has exactly 11 entries', () => {
    expect(ALL_SUBTYPES).toHaveLength(11);
  });

  it('ARTIFACT_TYPES has exactly 7 entries', () => {
    expect(ARTIFACT_TYPES).toHaveLength(7);
  });

  it('SUBTYPES_BY_TYPE.vision matches VISION_SUBTYPES', () => {
    expect(SUBTYPES_BY_TYPE.vision).toEqual(VISION_SUBTYPES);
  });

  it('SUBTYPES_BY_TYPE.choice matches CHOICE_SUBTYPES', () => {
    expect(SUBTYPES_BY_TYPE.choice).toEqual(CHOICE_SUBTYPES);
  });

  it('SUBTYPES_BY_TYPE.method matches METHOD_SUBTYPES', () => {
    expect(SUBTYPES_BY_TYPE.method).toEqual(METHOD_SUBTYPES);
  });

  it('subtypeSchemaForType(vision) accepts goal', () => {
    const schema = subtypeSchemaForType('vision');
    expect(schema.safeParse('goal').success).toBe(true);
  });

  it('subtypeSchemaForType(vision) rejects tool', () => {
    const schema = subtypeSchemaForType('vision');
    expect(schema.safeParse('tool').success).toBe(false);
  });
});
