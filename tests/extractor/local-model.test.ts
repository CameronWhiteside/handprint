// tests/extractor/local-model.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLocalProvider, ensureModel } from '../../src/extractor/local-model.js';
import { DEFAULT_MODEL_ID, modelPath, modelById } from '../../src/extractor/models.js';

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

  it('isAvailable false when not downloaded and onDownload returns false (consent refused)', async () => {
    const home = mkdtempSync(join(tmpdir(), 'hp-lm3-'));
    const p = createLocalProvider({
      modelId: DEFAULT_MODEL_ID,
      homeDir: home,
      onDownload: async () => false,
    });
    expect(await p.isAvailable()).toBe(false);
  });
});

describe('ensureModel integrity (item 2)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sha256 mismatch deletes the temp file and throws', async () => {
    const home = mkdtempSync(join(tmpdir(), 'hp-integrity-'));
    mkdirSync(join(home, 'models'), { recursive: true });

    const bodyBytes = new TextEncoder().encode('fake-model-bytes');
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bodyBytes);
        controller.close();
      },
    });

    vi.stubGlobal('fetch', async () => ({
      ok: true,
      status: 200,
      body,
    }));

    const entry = modelById(DEFAULT_MODEL_ID)!;
    const tmpPath = `${modelPath(entry, home)}.tmp`;

    // Use a deliberately wrong digest, the correct sha256 of 'fake-model-bytes'
    // is not 'deadbeef', so the integrity check must fail.
    await expect(
      ensureModel({ ...entry, sha256: 'deadbeef' }, home, async () => true),
    ).rejects.toThrow(/sha256 mismatch/);

    // The temp file must have been cleaned up, no partial file left behind.
    expect(existsSync(tmpPath)).toBe(false);
    // The final model path must also be absent (rename never happened).
    expect(existsSync(modelPath(entry, home))).toBe(false);
  });

  it('succeeds and renames to final path when sha256 matches', async () => {
    const { createHash } = await import('node:crypto');
    const home = mkdtempSync(join(tmpdir(), 'hp-integrity2-'));
    mkdirSync(join(home, 'models'), { recursive: true });

    const bodyBytes = new TextEncoder().encode('correct-bytes');
    const expectedDigest = createHash('sha256').update(bodyBytes).digest('hex');

    vi.stubGlobal('fetch', async () => ({
      ok: true,
      status: 200,
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bodyBytes);
          controller.close();
        },
      }),
    }));

    const entry = modelById(DEFAULT_MODEL_ID)!;
    const result = await ensureModel({ ...entry, sha256: expectedDigest }, home, async () => true);
    expect(result).toBe(true);
    expect(existsSync(modelPath(entry, home))).toBe(true);
    expect(existsSync(`${modelPath(entry, home)}.tmp`)).toBe(false);
  });
});
