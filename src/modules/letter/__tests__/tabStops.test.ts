import { describe, expect, it } from 'vitest';
import { parseStops, tabWidth } from '../tabStops';

describe('tab stops', () => {
  const stops = parseStops('r468,l144,c288');
  it('reads and sorts the stops', () => {
    expect(stops.map(s => s.pos)).toEqual([144, 288, 468]);
  });
  it('lines text up like Word: left, centered, right, then the 0.5" grid', () => {
    expect(tabWidth(80, stops, 40)).toBe(64);          // left stop at 144
    expect(tabWidth(180, stops, 40)).toBe(88);         // center of 40 pt at 288
    expect(tabWidth(300, stops, 50)).toBe(118);        // right edge at 468
    expect(tabWidth(470, stops, 10)).toBeCloseTo(34);  // past the last stop: next 36 pt
    expect(tabWidth(100, parseStops('d200'), 30, 12)).toBe(88); // decimal point on 200
  });
});
