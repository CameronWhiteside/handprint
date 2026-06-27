// src/sources/claude-code.ts
import { join } from 'node:path';
import { homedir } from 'node:os';
import type {
  SourceAdapter,
  SessionRef,
  NormalizedSession,
  TranscriptEntry,
  LocateOpts,
} from './types.js';
import { listJsonlFiles, readJsonlLines } from './jsonl-glob.js';

interface ContentItem {
  type: string;
  text?: string;
}

interface RawEntry {
  type: string;
  message?: { role: string; content: string | ContentItem[] };
  timestamp?: string;
  cwd?: string;
  sessionId?: string;
  gitBranch?: string;
}

function isTextItem(i: ContentItem): i is ContentItem & { text: string } {
  return i.type === 'text' && typeof i.text === 'string';
}

function extractText(content: string | ContentItem[]): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter(isTextItem)
    .map((i) => i.text)
    .join('');
}

export function parseClaudeLine(
  line: string,
  ref: SessionRef,
): TranscriptEntry | null {
  try {
    const raw: RawEntry = JSON.parse(line);
    if (raw.type !== 'user' && raw.type !== 'assistant') return null;
    if (!raw.message) return null;
    const text = extractText(raw.message.content);
    if (!text) return null;
    return {
      role: raw.type,
      text,
      timestamp: raw.timestamp ?? '',
      cwd: raw.cwd ?? '',
      sessionId: raw.sessionId ?? ref.sessionId,
      gitBranch: raw.gitBranch ?? '',
    };
  } catch {
    return null;
  }
}

function projectsDir(homeDir: string): string {
  return join(homeDir, '.claude', 'projects');
}

export const claudeCodeAdapter: SourceAdapter = {
  descriptor: {
    id: 'claude-code',
    displayName: 'Claude Code',
    sourceAgent: 'claude-code',
    capabilities: { timestamps: 'iso', session: true, project: true, gitBranch: true, model: false },
    locations: ['~/.claude/projects/*/*.jsonl'],
    implemented: true,
  },

  locate(opts?: LocateOpts): SessionRef[] {
    const home = opts?.homeDir ?? homedir();
    const base = projectsDir(home);
    return listJsonlFiles(base).map((f) => ({
      sourceId: 'claude-code' as const,
      sessionId: f.name.replace('.jsonl', ''),
      project: f.dir.replace(/-/g, '/').replace(/^\/Users\//, '~/'),
      locator: f.path,
      mtimeMs: f.mtimeMs,
    }));
  },

  parse(ref: SessionRef): NormalizedSession {
    const lines = readJsonlLines(ref.locator);
    const entries = lines
      .map((l) => parseClaudeLine(l, ref))
      .filter((e): e is TranscriptEntry => e !== null);
    return { ref, entries };
  },
};
