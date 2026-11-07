import { EVENT_FILL, contrastRatio } from '../calendarColors';

describe('calendar event colours', () => {
  it('computes known contrast ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    // The old bright green that this module replaces fails AA for white text
    expect(contrastRatio('#ffffff', '#52c41a')).toBeLessThan(3);
  });

  it.each(Object.entries(EVENT_FILL))('%s fill has WCAG AA contrast (>= 4.5) with white text', (_name, hex) => {
    expect(contrastRatio('#ffffff', hex)).toBeGreaterThanOrEqual(4.5);
  });
});
