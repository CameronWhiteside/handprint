import { describe, it, expect } from 'vitest';
import {
  VISION_SUBTYPES,
  CHOICE_SUBTYPES,
  METHOD_SUBTYPES,
  ARTIFACT_TYPES,
} from '@handprint/types';
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

  // Drift guard: the grammar is generated from @handprint/types, so every enum
  // value must appear. If someone adds a subtype to the taxonomy, this fails
  // until the grammar picks it up (it does automatically now), and if someone
  // reverts the grammar to a hardcoded copy that misses a value, this catches it.
  it('stays in sync with every @handprint/types enum value', () => {
    const all = [
      ...VISION_SUBTYPES,
      ...CHOICE_SUBTYPES,
      ...METHOD_SUBTYPES,
      ...ARTIFACT_TYPES,
    ];
    for (const value of all) {
      expect(EXTRACTION_GBNF).toContain(`"${value}"`);
    }
  });
});
