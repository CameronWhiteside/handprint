// tests/sources/types.test.ts
import { describe, it, expect } from 'vitest';
import { NotImplementedError } from '../../src/sources/types.js';

describe('source types', () => {
  it('NotImplementedError carries the adapter id', () => {
    const err = new NotImplementedError('codex');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('codex');
    expect(err.message).toContain('adding-a-source-adapter');
  });
});
