// tests/extractor/local-model.test.ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLocalProvider } from '../../src/extractor/local-model.js';
import { DEFAULT_MODEL_ID, modelPath } from '../../src/extractor/models.js';

describe('local-model provider', () => {
  it('labels itself local:<modelId>', () => {
    const p = createLocalProvider({ modelId: DEFAULT_MODEL_ID, homeDir: '/tmp/x' });
    expect(p.label()).toBe(`local:${DEFAULT_MODEL_ID}`);
  });

  it('isAvailable true when the model file already exists', async () => {
    const home = mkdtempSync(join(tmpdir(), 'hp-lm-'));
    mkdirSync(join(home, 'models'), { recursive: true });
    // create a placeholder file at the model path so the existence check passes
    const { modelById } = await import('../../src/extractor/models.js');
    writeFileSync(modelPath(modelById(DEFAULT_MODEL_ID)!, home), 'gguf-bytes');
    const p = createLocalProvider({ modelId: DEFAULT_MODEL_ID, homeDir: home });
    expect(await p.isAvailable()).toBe(true);
  });

  it('isAvailable false when not downloaded and no consent callback', async () => {
    const home = mkdtempSync(join(tmpdir(), 'hp-lm2-'));
    const p = createLocalProvider({ modelId: DEFAULT_MODEL_ID, homeDir: home });
    expect(await p.isAvailable()).toBe(false);
  });
});
