import { stableStringify } from '../../src/common/stable-json.js';

describe('stableStringify', () => {
  it('ignores key order at every depth', () => {
    expect(stableStringify({ b: 1, a: { d: [{ y: 1, x: 2 }], c: 3 } })).toBe(
      stableStringify({ a: { c: 3, d: [{ x: 2, y: 1 }] }, b: 1 }),
    );
  });

  it('keeps array order significant', () => {
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
  });
});
