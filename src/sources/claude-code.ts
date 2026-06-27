// src/sources/claude-code.ts
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type {
  SourceAdapter,
  SessionRef,
  NormalizedSession,
  TranscriptEntry,
  LocateOpts,
} from './types.js';

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
    if (!existsSync(base)) return [];
    const refs: SessionRef[] = [];
    for (const project of readdirSync(base)) {
      const projectDir = join(base, project);
      let files: string[];
      try {
        files = readdirSync(projectDir).filter((f) => f.endsWith('.jsonl'));
      } catch {
        continue;
      }
      for (const file of files) {
        const path = join(projectDir, file);
        let mtimeMs = 0;
        try {
          mtimeMs = statSync(path).mtimeMs;
        } catch {
          /* ignore */
        }
        refs.push({
          sourceId: 'claude-code',
          sessionId: file.replace('.jsonl', ''),
          project: project.replace(/-/g, '/').replace(/^\/Users\//, '~/'),
          locator: path,
          mtimeMs,
        });
      }
    }
    return refs;
  },

  parse(ref: SessionRef): NormalizedSession {
    const lines = readFileSync(ref.locator, 'utf-8').split('\n');
    const entries = lines
      .map((l) => parseClaudeLine(l, ref))
      .filter((e): e is TranscriptEntry => e !== null);
    return { ref, entries };
  },
};
