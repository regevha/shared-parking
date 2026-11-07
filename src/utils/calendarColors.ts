/**
 * Calendar event colours.
 *
 * Event blocks use white text, so every fill must reach WCAG AA contrast (4.5:1) against white.
 * (Ant Design's bright "#52c41a" style colours do not: 2.3:1.) The hues are unchanged, only darkened.
 *
 * `ACCENT_TEXT` is for coloured *text* on a card (stats numbers, the "available" tick). It is theme
 * aware: the CSS variables are defined in App.css (dark enough on light cards, light enough on dark).
 */
export const EVENT_FILL = {
  approved: '#237804',
  pending: '#ad4e00',
  pendingBlue: '#0958d9',
  rejected: '#cf1322',
  available: '#006d75',
} as const;

export const ACCENT_TEXT = {
  booked: 'var(--accent-booked)',
  pending: 'var(--accent-pending)',
  blocked: 'var(--accent-blocked)',
  available: 'var(--accent-available)',
} as const;

/** WCAG 2.x relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two #rrggbb colours (1–21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
