import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';

export interface ModelEntry {
  id: string;
  displayName: string;
  url: string; // direct GGUF download
  sizeMb: number;
  ramGb: number;
  notes: string;
  // TODO: pin sha256 once published digests are confirmed
  sha256?: string;
}

// Lightest-appropriate-first. The grab flow presents these and asks the
// user/agent to choose the smallest one their machine can run.
export const MODELS: ModelEntry[] = [
  {
    id: 'qwen2.5-1.5b-instruct-q4',
    displayName: 'Qwen2.5 1.5B Instruct (Q4_K_M)',
    url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
    sizeMb: 1100,
    ramGb: 2,
    notes: 'Lightest. Good for short structured extraction on 8GB machines / no GPU.',
  },
  {
    id: 'qwen2.5-3b-instruct-q4',
    displayName: 'Qwen2.5 3B Instruct (Q4_K_M)',
    url: 'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf',
    sizeMb: 2000,
    ramGb: 4,
    notes: 'Recommended default. Strong JSON adherence; fast on Apple Silicon.',
  },
  {
    id: 'llama-3.2-3b-instruct-q4',
    displayName: 'Llama 3.2 3B Instruct (Q4_K_M)',
    url: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    sizeMb: 2000,
    ramGb: 4,
    notes: 'Alternative 3B if Qwen output quality is poor for your transcripts.',
  },
];

export const DEFAULT_MODEL_ID = 'qwen2.5-3b-instruct-q4';

export function modelById(id: string): ModelEntry | undefined {
  return MODELS.find((m) => m.id === id);
}

export function modelsDir(homeDir?: string): string {
  const base = homeDir ?? process.env.HANDPRINT_HOME ?? join(homedir(), '.handprint');
  return join(base, 'models');
}

export function modelPath(entry: ModelEntry, homeDir?: string): string {
  return join(modelsDir(homeDir), `${entry.id}.gguf`);
}

export function isModelDownloaded(entry: ModelEntry, homeDir?: string): boolean {
  return existsSync(modelPath(entry, homeDir));
}
