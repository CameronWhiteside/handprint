// GBNF grammar passed to node-llama-cpp so the local model can only emit JSON
// that matches our Mark[]/Artifact[] shape. Enums mirror @handprint/types.
// Note: enum values appear unquoted in their own rule; the parent rule wraps
// them in JSON quotes ("\"" marktype "\"") so the runtime output is valid JSON.
export const EXTRACTION_GBNF = `
root        ::= "[" ws ( extraction ( ws "," ws extraction )* )? ws "]"
extraction  ::= "{" ws
                  "\\"marks\\"" ws ":" ws markarr ws "," ws
                  "\\"artifacts\\"" ws ":" ws artarr ws "," ws
                  "\\"timestamp\\"" ws ":" ws string
                ws "}"
markarr     ::= "[" ws ( mark ( ws "," ws mark )* )? ws "]"
mark        ::= "{" ws
                  "\\"type\\"" ws ":" ws "\\"" marktype "\\"" ws "," ws
                  "\\"subtype\\"" ws ":" ws "\\"" subtype "\\"" ws "," ws
                  "\\"note\\"" ws ":" ws string
                ws "}"
marktype    ::= "vision" | "choice" | "method"
subtype     ::= "goal" | "direction" | "principle"
             | "approval" | "override" | "rejection" | "constraint" | "inquiry"
             | "tool" | "knowledge" | "process"
artarr      ::= "[" ws ( artifact ( ws "," ws artifact )* )? ws "]"
artifact    ::= "{" ws
                  "\\"type\\"" ws ":" ws "\\"" arttype "\\"" ws "," ws
                  "\\"uri\\"" ws ":" ws string
                ws "}"
arttype     ::= "git-commit" | "git-repo" | "file" | "url" | "deployment" | "c2pa" | "custom"
string      ::= "\\"" ( [^"\\\\] | "\\\\" . )* "\\""
ws          ::= [ \\t\\n]*
`.trim();
