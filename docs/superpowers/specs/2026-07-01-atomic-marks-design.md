# Atomic marks: richer, granular decision extraction

**Status:** approved design, ready for implementation plan
**Date:** 2026-07-01
**Repos:** handprint (extraction + schema) and handprint-web (display)

## Goal

Turn each human decision in a transcript into many tiny, standalone "marks" instead of one dense sentence. A mark should be the most atomic representation of a piece of human judgment: a single outcome, decision, tool, or belief. Marks are isolated for vectorization and become meaningful again when combined in aggregate.

The magic to protect: this must be **fast and low-token** while producing **atomic, structured** captures of human decisions. Short notes are low output tokens, so atomicity and speed pull in the same direction.

## Success criteria

- A real conversation yields roughly **4-10 marks** (today it is ~1-2), and a single dense decision decomposes into **4-8 marks**.
- Each note reads as a **~5-word standalone belief or command**, understandable with zero surrounding context.
- Tools, technologies, and categories are captured as their own `method/tool` marks (bare entity names are valid).
- Output stays compact: each mark is tiny (~5 words plus minimal JSON), so even 6-8 marks per decision remain a small, fast payload. More marks add JSON structure, but short notes keep the per-mark cost low.
- No change to the number of model calls (one pass per chunk).

## Non-goals

- No change to the taxonomy types. `vision` / `choice` / `method` and their subtypes stay exactly as they are.
- No two-pass or post-processing "atomizer". One model call per chunk.
- No migration of already-signed marks. Existing long marks remain valid; new extraction (and the user's re-ingest) produces atomic marks.

## 1. Taxonomy and granularity (types unchanged)

Keep the current schema:

- `vision` (goal | direction | principle): the outcome the human wants.
- `choice` (approval | override | rejection | constraint | inquiry): the decision the human made.
- `method` (tool | knowledge | process): what the human applied.
  - `tool`: named tools, technologies, and categories. Bare entity names are valid marks.
  - `knowledge`: a principle or fact stated from experience.
  - `process`: a technique or way of working.

Granularity target, worked examples:

"use Postgres, not Mongo, we need transactions" decomposes to one handprint with these marks:

- `choice/override` "Postgres over MongoDB"
- `vision/goal` "Maintain transaction integrity"
- `method/tool` "Postgres"
- `method/tool` "MongoDB"
- `method/tool` "SQL vs NoSQL"
- `method/knowledge` "Postgres has stronger transactions"

"reuse the same GTM container ID across recruiter-bot and careers for consistency":

- `vision/goal` "Unify tag management"
- `vision/direction` "Consistent cross-platform tracking"
- `choice/override` "Reuse one GTM container ID"
- `method/tool` "Google Tag Manager"
- `method/knowledge` "Shared GTM containers stay consistent"

## 2. Prompt rewrite (one pass)

File: `src/extractor/prompt.ts` (`SYSTEM_PROMPT`). Reframe from "one handprint per decision, full sentence" to "decompose each decision into every atomic facet, one mark per facet". Keep the schema-grounded enum interpolation, the untrusted-transcript fencing, and the no-markdown-fence output rule unchanged.

New behavioral rules to add:

- **Decompose, do not summarize.** A single decision usually yields several marks: the outcome (vision), the decision itself (choice), each tool or category (method/tool), and any principle (method/knowledge).
- **Note rules:** about 5 words; hard limit `MARK_NOTE_MAX` characters; stand alone with zero context (no "this/that/the above" or pronouns referring to the chat); a short third-person belief or command about the human's judgment.
- **Bare entities count:** tool, technology, and category names are valid `method/tool` marks.
- Keep INCLUDE/EXCLUDE (exclude routine/mechanical instructions, bare approvals, and anything the AI decided on its own).

Replace the single-example section with two worked few-shot examples that show the full explosion, aligned to the real output envelope (`{ "marks": [...], "artifacts": [...], "timestamp": ... }`). Draft:

```
DECOMPOSE, DON'T SUMMARIZE
One decision usually becomes several marks. Emit one handprint whose "marks"
array holds every atomic facet.

Example. Human: "use Postgres, not Mongo, we need transactions"
[{"marks":[
  {"type":"choice","subtype":"override","note":"Postgres over MongoDB"},
  {"type":"vision","subtype":"goal","note":"Maintain transaction integrity"},
  {"type":"method","subtype":"tool","note":"Postgres"},
  {"type":"method","subtype":"tool","note":"MongoDB"},
  {"type":"method","subtype":"tool","note":"SQL vs NoSQL"},
  {"type":"method","subtype":"knowledge","note":"Postgres has stronger transactions"}
],"artifacts":[],"timestamp":"<ISO from transcript>"}]

Example. Human: "reuse the same GTM container ID across recruiter-bot and
careers for consistency"
[{"marks":[
  {"type":"vision","subtype":"goal","note":"Unify tag management"},
  {"type":"vision","subtype":"direction","note":"Consistent cross-platform tracking"},
  {"type":"choice","subtype":"override","note":"Reuse one GTM container ID"},
  {"type":"method","subtype":"tool","note":"Google Tag Manager"},
  {"type":"method","subtype":"knowledge","note":"Shared GTM containers stay consistent"}
],"artifacts":[],"timestamp":"<ISO from transcript>"}]

Negative. Human: "fix the typo on line 12" -> no judgment, return []
```

Note rules and the schema line reference `MARK_NOTE_MAX`, which is interpolated from `@handprint/types`, so the prompt and schema cannot drift.

## 3. Schema change

File: `packages/types/src/handprint.ts`.

- `MARK_NOTE_MAX`: **280 -> 48** characters (about 5-7 words; tunable). Chosen so a ~5-word note fits comfortably while the cap forces brevity.
- `note` stays `z.string().min(1).max(MARK_NOTE_MAX)`.
- The parser (`parseExtractionJson` in `src/extractor/types.ts`) already salvages an over-length note by truncating to `MARK_NOTE_MAX` and re-validating, so a mark is never dropped for being too long.
- Rebuild `packages/types` so its `dist` carries the new value (the CLI imports it).

## 4. handprint-web: a transparent, humanized view of the mark data

Principle: the web shows the same JSON data as faithfully as possible, just prettified. It reveals the actual structure and hierarchy of the record rather than abstracting or summarizing it. The display maps one-to-one to the data; do not transform, only humanize.

- **Faithful:** every field a handprint carries is visible: each mark's `type`, `subtype`, and `note`; the `artifacts`; the `timestamp`. No lossy rewrite back into a sentence.
- **Hierarchy:** render the handprint as the container with its `marks` nested inside, so the one-to-many relationship (one handprint, many marks) is obvious at a glance, and artifacts and timestamp sit at the handprint level.
- **Humanized:** a mark renders as a chip = `type` (color group) + `subtype` (prominent label) + `note` (the ~5 words). Marks group by `type` (vision / choice / method); `subtype` is the meaningful labeling axis. Prettify with color, grouping, and readable typography, but never at the cost of transparency.
- Applies wherever marks render: the public profile (`/u/[handle]`), the dashboard, and the handprint detail view.

This is in scope for this spec. It ships as a second PR (see section 7) after the extraction change lands, so richer marks exist to display.

## 5. Backward compatibility

- Already-signed handprints keep their long notes and remain valid (they are not re-validated).
- New extraction and any `handprint reset` + re-ingest produce atomic marks.
- The web display must render both old (one long note) and new (many short marks) shapes without breaking.

## 6. Testing and metrics

Extraction (handprint):

- Unit: a mock provider returns the Postgres decomposition JSON; assert `parseExtractionJson` yields one handprint with >= 4 marks, each note <= `MARK_NOTE_MAX`, covering `vision`, `choice`, `method/tool`, and `method/knowledge`.
- Unit: the salvage/truncation test in the parser is updated for the 48-char cap (an over-length note is truncated, not dropped).
- Types: `packages/types` tests confirm `markSchema` accepts a 48-char note and rejects a 49-char one (or truncation covers it upstream).
- Manual: one live `grab` on a substantive session with `HANDPRINT_DEBUG=1`, confirming 4-10 short marks and reading them for standalone clarity.

Metrics to eyeball on the live run:

- marks-per-chat in the 4-10 range,
- note length near 5 words,
- output payload per chunk stays small (short notes keep per-mark cost low; compare the debug output size to confirm it is not bloated).

Web (handprint-web): a component/render test that a mark renders its subtype label and is grouped by type.

## 7. Implementation phasing

1. **Extraction + schema** (handprint): note cap 280 -> 48, prompt rewrite, tests. One PR. This is the core and unblocks re-ingest.
2. **Web display** (handprint-web): mark chips grouped by type with subtype labels. Separate PR, after (1).
