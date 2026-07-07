// GBNF grammar passed to node-llama-cpp so the local model can only emit JSON
// that matches our Mark[]/Artifact[] shape. Every enum is derived from
// @handprint/types (the single source of truth) so the grammar can never drift
// from the schema the way a hardcoded copy would.
// Note: enum values appear unquoted in their own rule; the parent rule wraps
// them in JSON quotes ("\"" marktype "\"") so the runtime output is valid JSON.
//
// The three mark rules (vision-mark, choice-mark, method-mark) are coupled so
// the grammar only allows valid type/subtype pairs. A bare "mark" rule that
// pairs any type with any subtype would permit cross-type combinations that Zod
// silently drops; coupled rules prevent them from being emitted at all.
// llama.cpp's GBNF parser ends a rule at the first newline — it has no line
// continuation, so every rule body below must stay on a single line.
import {
  VISION_SUBTYPES,
  CHOICE_SUBTYPES,
  METHOD_SUBTYPES,
  ARTIFACT_TYPES,
} from '@handprint/types';

/** A GBNF alternation of quoted string literals, e.g. `"goal" | "direction"`. */
const alt = (values: readonly string[]): string => values.map((v) => `"${v}"`).join(' | ');

export const EXTRACTION_GBNF = `
root          ::= "[" ws ( extraction ( ws "," ws extraction )* )? ws "]"
extraction    ::= "{" ws "\\"marks\\"" ws ":" ws markarr ws "," ws "\\"artifacts\\"" ws ":" ws artarr ws "," ws "\\"timestamp\\"" ws ":" ws string ws "}"
markarr       ::= "[" ws ( mark ( ws "," ws mark )* )? ws "]"
mark          ::= vision-mark | choice-mark | method-mark
vision-mark   ::= "{" ws "\\"type\\"" ws ":" ws "\\"vision\\"" ws "," ws "\\"subtype\\"" ws ":" ws "\\"" vision-subtype "\\"" ws "," ws "\\"note\\"" ws ":" ws string ws "}"
vision-subtype ::= ${alt(VISION_SUBTYPES)}
choice-mark   ::= "{" ws "\\"type\\"" ws ":" ws "\\"choice\\"" ws "," ws "\\"subtype\\"" ws ":" ws "\\"" choice-subtype "\\"" ws "," ws "\\"note\\"" ws ":" ws string ws "}"
choice-subtype ::= ${alt(CHOICE_SUBTYPES)}
method-mark   ::= "{" ws "\\"type\\"" ws ":" ws "\\"method\\"" ws "," ws "\\"subtype\\"" ws ":" ws "\\"" method-subtype "\\"" ws "," ws "\\"note\\"" ws ":" ws string ws "}"
method-subtype ::= ${alt(METHOD_SUBTYPES)}
artarr        ::= "[" ws ( artifact ( ws "," ws artifact )* )? ws "]"
artifact      ::= "{" ws "\\"type\\"" ws ":" ws "\\"" arttype "\\"" ws "," ws "\\"uri\\"" ws ":" ws string ( ws "," ws "\\"hash\\"" ws ":" ws string )? ( ws "," ws "\\"parent\\"" ws ":" ws string )? ws "}"
arttype       ::= ${alt(ARTIFACT_TYPES)}
string        ::= "\\"" ( [^"\\\\] | "\\\\" . )* "\\""
ws            ::= [ \\t\\n]*
`.trim();
