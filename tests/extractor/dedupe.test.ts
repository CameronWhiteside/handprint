// tests/extractor/dedupe.test.ts
import { describe, it, expect } from 'vitest';
import { dedupeMarks } from '../../src/extractor/dedupe.js';
import type { RawExtraction } from '../../src/extractor/types.js';

const extraction = (note: string, overrides: Partial<RawExtraction> = {}): RawExtraction => ({
  marks: [{ type: 'choice', subtype: 'override', note }],
  artifacts: [],
  timestamp: '2026-06-02T16:49:50Z',
  ...overrides,
});

describe('dedupeMarks', () => {
  it('collapses the two near-verbatim paraphrases of a real duplicate triple, keeping the first', () => {
    // Real output from one grab: three chips for a single decision. The 2nd
    // and 3rd notes are near-verbatim paraphrases of each other ("migrate
    // from handprint-sh to handprint-web, retiring/retire the old system")
    // and collapse into the first of the pair. The 1st note describes the
    // same decision with different emphasis (repo/worker/setup vs.
    // retiring/system) and survives as a related-but-distinct mark, which is
    // the correct call: dedup should not merge notes just because they're
    // topically adjacent.
    const extractions: RawExtraction[] = [
      extraction('Decided to replace the old handprint-sh repo and worker with the new handprint-web setup.'),
      extraction('Decided to migrate from handprint-sh to handprint-web, retiring the old system.'),
      extraction('Chose to migrate from handprint-sh to handprint-web and retire the old system.'),
    ];

    const out = dedupeMarks(extractions);
    expect(out).toHaveLength(2);
    expect(out.flatMap((e) => e.marks.map((m) => m.note))).toEqual([
      'Decided to replace the old handprint-sh repo and worker with the new handprint-web setup.',
      'Decided to migrate from handprint-sh to handprint-web, retiring the old system.',
    ]);
  });

  it('keeps different decisions of the same type/subtype', () => {
    const extractions: RawExtraction[] = [
      extraction('Postgres over MongoDB for the primary datastore'),
      extraction('Chose Vitest for testing'),
    ];

    const out = dedupeMarks(extractions);
    expect(out).toHaveLength(2);
    expect(out.flatMap((e) => e.marks.map((m) => m.note))).toEqual([
      'Postgres over MongoDB for the primary datastore',
      'Chose Vitest for testing',
    ]);
  });

  it('keeps the same note text when type/subtype differ', () => {
    const extractions: RawExtraction[] = [
      { marks: [{ type: 'choice', subtype: 'override', note: 'migrate from handprint-sh to handprint-web' }], artifacts: [], timestamp: 't1' },
      { marks: [{ type: 'method', subtype: 'process', note: 'migrate from handprint-sh to handprint-web' }], artifacts: [], timestamp: 't2' },
    ];

    const out = dedupeMarks(extractions);
    expect(out).toHaveLength(2);
  });

  it('drops extractions that become mark-less after dedupe', () => {
    const extractions: RawExtraction[] = [
      extraction('Decided to migrate from handprint-sh to handprint-web'),
      {
        marks: [
          { type: 'choice', subtype: 'override', note: 'Chose to migrate from handprint-sh to handprint-web' },
        ],
        artifacts: [{ type: 'file', uri: 'src/foo.ts' }],
        timestamp: 't2',
      },
    ];

    const out = dedupeMarks(extractions);
    expect(out).toHaveLength(1);
  });

  it('preserves multiple distinct marks within a single extraction', () => {
    const extractions: RawExtraction[] = [
      {
        marks: [
          { type: 'choice', subtype: 'override', note: 'Postgres over MongoDB' },
          { type: 'vision', subtype: 'goal', note: 'Ship the v2 rewrite by Friday' },
        ],
        artifacts: [],
        timestamp: 't1',
      },
    ];

    const out = dedupeMarks(extractions);
    expect(out).toHaveLength(1);
    expect(out[0].marks).toHaveLength(2);
  });

  it('returns an empty array for empty input', () => {
    expect(dedupeMarks([])).toEqual([]);
  });
});
