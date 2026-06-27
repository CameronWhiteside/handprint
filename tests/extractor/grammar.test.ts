import { describe, it, expect } from 'vitest';
import { EXTRACTION_GBNF } from '../../src/extractor/grammar.js';

describe('extraction grammar', () => {
  it('constrains mark type and subtype to the known enums', () => {
    expect(EXTRACTION_GBNF).toContain('"vision"');
    expect(EXTRACTION_GBNF).toContain('"choice"');
    expect(EXTRACTION_GBNF).toContain('"method"');
    expect(EXTRACTION_GBNF).toContain('"override"');
    expect(EXTRACTION_GBNF).toContain('root');
  });
});
