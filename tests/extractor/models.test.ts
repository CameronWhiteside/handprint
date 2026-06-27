import { describe, it, expect } from 'vitest';
import { MODELS, DEFAULT_MODEL_ID, modelById, modelsDir, modelPath } from '../../src/extractor/models.js';

describe('model registry', () => {
  it('has a default model present in the registry', () => {
    expect(modelById(DEFAULT_MODEL_ID)).toBeDefined();
  });
  it('every model entry has a download url and size', () => {
    for (const m of MODELS) {
      expect(m.url).toMatch(/^https?:\/\//);
      expect(m.sizeMb).toBeGreaterThan(0);
    }
  });
  it('modelPath lives under the handprint home models dir', () => {
    const entry = modelById(DEFAULT_MODEL_ID)!;
    const dir = modelsDir('/tmp/hp-home');
    expect(dir).toBe('/tmp/hp-home/models');
    expect(modelPath(entry, '/tmp/hp-home').startsWith(dir)).toBe(true);
    expect(modelPath(entry, '/tmp/hp-home')).toMatch(/\.gguf$/);
  });
});
