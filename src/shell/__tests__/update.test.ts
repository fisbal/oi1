import { describe, expect, it } from 'vitest';
import { newer } from '../update';

describe('newer', () => {
  it('compares versions number by number', () => {
    expect(newer('v0.1.42', '0.1.9')).toBe(true);
    expect(newer('0.1.9', '0.1.42')).toBe(false);
    expect(newer('0.2.0', '0.1.99')).toBe(true);
    expect(newer('v0.1.7', '0.1.7')).toBe(false);
  });
});
