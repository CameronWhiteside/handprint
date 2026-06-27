import { describe, it, expect } from 'vitest';
import { hashObject, canonicalize, sha256 } from '../../src/store/hash.js';
import { ensureSodium } from '../../src/crypto/sodium.js';

describe('canonicalize', () => {
  it('sorts object keys', () => {
    const result = canonicalize({ b: 1, a: 2 });
    expect(result).toBe('{"a":2,"b":1}');
  });

  it('sorts nested object keys', () => {
    const result = canonicalize({ z: { b: 1, a: 2 }, a: 3 });
    expect(result).toBe('{"a":3,"z":{"a":2,"b":1}}');
  });

  it('handles arrays (no sorting)', () => {
    const result = canonicalize([3, 1, 2]);
    expect(result).toBe('[3,1,2]');
  });

  it('handles null', () => {
    expect(canonicalize(null)).toBe('null');
  });

  it('handles strings', () => {
    expect(canonicalize('hello')).toBe('"hello"');
  });

  it('handles booleans', () => {
    expect(canonicalize(true)).toBe('true');
  });
});

describe('hashObject', () => {
  it('returns 64-char hex string', async () => {
    await ensureSodium();
    const hash = await hashObject({ a: 1 });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic', async () => {
    const h1 = await hashObject({ x: 1, y: 2 });
    const h2 = await hashObject({ y: 2, x: 1 });
    expect(h1).toBe(h2);
  });

  it('differs for different objects', async () => {
    const h1 = await hashObject({ a: 1 });
    const h2 = await hashObject({ a: 2 });
    expect(h1).not.toBe(h2);
  });
});

describe('sha256', () => {
  it('returns 32 bytes', async () => {
    await ensureSodium();
    const hash = sha256(new TextEncoder().encode('test'));
    expect(hash.length).toBe(32);
  });
});
