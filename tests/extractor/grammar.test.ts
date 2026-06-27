import { describe, it, expect } from 'vitest';
import { EXTRACTION_GBNF } from '../../src/extractor/grammar.js';

describe('extraction grammar', () => {
  it('constrains mark type and subtype to the known enums via coupled rules', () => {
    // Coupled rule names must be present
    expect(EXTRACTION_GBNF).toContain('vision-mark');
    expect(EXTRACTION_GBNF).toContain('choice-mark');
    expect(EXTRACTION_GBNF).toContain('method-mark');
    // Subtype values from the coupled sub-rules
    expect(EXTRACTION_GBNF).toContain('"override"');
    expect(EXTRACTION_GBNF).toContain('root');
  });

  it('has a coupled vision-mark rule with vision-subtype', () => {
    // vision-mark must pair "vision" type with only vision subtypes
    expect(EXTRACTION_GBNF).toContain('vision-mark');
    expect(EXTRACTION_GBNF).toContain('vision-subtype');
    // vision subtypes present in the grammar
    expect(EXTRACTION_GBNF).toContain('"goal"');
    expect(EXTRACTION_GBNF).toContain('"direction"');
    expect(EXTRACTION_GBNF).toContain('"principle"');
  });

  it('has a coupled choice-mark rule with choice-subtype', () => {
    // choice-mark must pair "choice" type with only choice subtypes
    expect(EXTRACTION_GBNF).toContain('choice-mark');
    expect(EXTRACTION_GBNF).toContain('choice-subtype');
    // choice subtypes present in the grammar
    expect(EXTRACTION_GBNF).toContain('"approval"');
    expect(EXTRACTION_GBNF).toContain('"rejection"');
    expect(EXTRACTION_GBNF).toContain('"constraint"');
    expect(EXTRACTION_GBNF).toContain('"inquiry"');
  });

  it('dispatches mark to the three coupled sub-rules', () => {
    expect(EXTRACTION_GBNF).toContain('mark          ::= vision-mark | choice-mark | method-mark');
  });
});
