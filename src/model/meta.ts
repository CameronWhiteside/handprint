export interface DecisionMeta {
  seal: string; // hash of the seal this decision was extracted from
  type: string; // vision | choice | method
  subtype?: string; // e.g. override, rejection, constraint, tools, knowledge
  intent: string; // what the human wanted
  risk: string; // what could go wrong
  context: string; // domain/project context
  confidence: number | null;
  horizon: string | null;
  anchors: Array<{ label: string; verified: boolean }>;
  source: string; // claude-code, cursor, terminal, etc.
  status: "open" | "resolved";
  resolutions: Array<{
    status: string; // validated, partial, revised, invalidated
    body: string;
    timestamp: string;
  }>;
}
