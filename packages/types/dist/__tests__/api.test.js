import { describe, it, expect } from 'vitest';
import { pushHandprintInputSchema, handprintsQuerySchema, searchQuerySchema, registerKeyInputSchema, } from '../api.js';
// ── pushHandprintInput ──────────────────────────────────────────
describe('pushHandprintInputSchema', () => {
    const validInput = {
        v: 1,
        ts: '2026-06-26T00:00:00Z',
        marks: [{ type: 'vision', subtype: 'goal', note: 'build a CLI tool' }],
        source: { agent: 'claude-code/opus-4-8' },
        parent: null,
        sig: 'sig-value',
        pubkey: 'pubkey-value',
    };
    it('accepts a valid pushHandprintInput', () => {
        const result = pushHandprintInputSchema.safeParse(validInput);
        expect(result.success).toBe(true);
    });
    it('defaults artifacts to empty array', () => {
        const result = pushHandprintInputSchema.safeParse(validInput);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.artifacts).toEqual([]);
        }
    });
});
// ── handprintsQuerySchema ───────────────────────────────────────
describe('handprintsQuerySchema', () => {
    it('applies default limit=50, offset=0, sort=-ts', () => {
        const result = handprintsQuerySchema.safeParse({});
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.limit).toBe(50);
            expect(result.data.offset).toBe(0);
            expect(result.data.sort).toBe('-ts');
        }
    });
    it('rejects limit > 100', () => {
        const result = handprintsQuerySchema.safeParse({ limit: 101 });
        expect(result.success).toBe(false);
    });
});
// ── searchQuerySchema ───────────────────────────────────────────
describe('searchQuerySchema', () => {
    it('rejects empty q', () => {
        const result = searchQuerySchema.safeParse({ q: '' });
        expect(result.success).toBe(false);
    });
});
// ── registerKeyInputSchema ──────────────────────────────────────
describe('registerKeyInputSchema', () => {
    it('validates label max 64 chars', () => {
        const result = registerKeyInputSchema.safeParse({
            pubkey: 'some-key',
            label: 'x'.repeat(65),
        });
        expect(result.success).toBe(false);
    });
    it('accepts a valid label within 64 chars', () => {
        const result = registerKeyInputSchema.safeParse({
            pubkey: 'some-key',
            label: 'My Laptop',
        });
        expect(result.success).toBe(true);
    });
});
//# sourceMappingURL=api.test.js.map