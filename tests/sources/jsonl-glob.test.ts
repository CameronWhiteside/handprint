// tests/sources/jsonl-glob.test.ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listJsonlFiles } from '../../src/sources/jsonl-glob.js';

function makeFixture(): { baseDir: string; childDir: string; filePath: string } {
  const baseDir = mkdtempSync(join(tmpdir(), 'hp-jg-'));
  const childDir = join(baseDir, 'my-project');
  mkdirSync(childDir, { recursive: true });
  const filePath = join(childDir, 'sess-abc.jsonl');
  writeFileSync(filePath, '{"line":1}\n{"line":2}\n');
  return { baseDir, childDir, filePath };
}

describe('listJsonlFiles', () => {
  it('finds a nested .jsonl file with its mtime and dir', () => {
    const { baseDir, filePath } = makeFixture();
    const files = listJsonlFiles(baseDir);
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe(filePath);
    expect(files[0].dir).toBe('my-project');
    expect(files[0].name).toBe('sess-abc.jsonl');
    expect(files[0].mtimeMs).toBeGreaterThan(0);
  });

  it('returns [] when baseDir does not exist', () => {
    const files = listJsonlFiles('/tmp/hp-jg-does-not-exist-ever');
    expect(files).toEqual([]);
  });

  it('ignores non-.jsonl files', () => {
    const { baseDir, childDir } = makeFixture();
    writeFileSync(join(childDir, 'notes.txt'), 'hello');
    const files = listJsonlFiles(baseDir);
    expect(files.every((f) => f.name.endsWith('.jsonl'))).toBe(true);
  });
});
