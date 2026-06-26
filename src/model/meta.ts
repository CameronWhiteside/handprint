export interface DecisionMeta {
  seal: string; // hash of the seal this decision was extracted from
  ts: string; // ISO timestamp of when decision was made
  type: string; // vision | choice | method
  subtype?: string; // e.g. override, rejection, constraint, tools, knowledge
  intent: string; // what the human wanted
  risk: string; // what could go wrong
  context: string; // domain/project context
  project?: string; // project identifier (e.g. repo name, directory)
  repo?: string; // git remote URL if available
  branch?: string; // git branch at time of decision
  confidence: number | null;
  horizon: string | null;
  anchors: Array<{ label: string; verified: boolean }>;
  source: string; // claude-code, cursor, terminal, etc.
  status: "open" | "resolved";
  outcome?: string; // what actually happened — filled in later
  resolutions: Array<{
    status: string; // validated, partial, revised, invalidated
    body: string;
    timestamp: string;
  }>;
}
