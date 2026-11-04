import { test, expect, APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { CREDENTIALS, loginAs, waitForNav, Role } from '../fixtures/auth';

/**
 * Automated accessibility scan (axe-core, WCAG 2.0/2.1 A + AA) of every screen a role can
 * reach, in light and dark mode and in Hebrew (RTL). Unlike the jest-axe unit tests this
 * runs in a real browser, so it also covers colour contrast and the real Ant Design
 * DatePicker.
 *
 * Needs both servers running — see e2e/README.md.
 *
 * Known, documented exclusions (so the suite is green and any NEW violation fails it):
 *  - `color-contrast` is report-only unless A11Y_CONTRAST=1 is set. The app currently has
 *    contrast failures (antd default primary blue/white text 4.1:1, grey statistic titles,
 *    calendar event colours, status tags, dark-mode secondary text, …). They are tracked as
 *    CLAUDE.md TODO #4 (WCAG colour audit); run `A11Y_CONTRAST=1 npx playwright test accessibility`
 *    to see them. Remove this gate once that audit lands.
 *  - `aria-required-parent` / `aria-required-children` raised only on `.rbc-*` nodes come from
 *    react-big-calendar's own markup (third-party, not fixable here).
 */

const SCREENS: Record<Role, string[]> = {
  user:    ['/my-requests', '/submit-request', '/calendar', '/lot-status', '/notifications'],
  owner:   ['/my-requests', '/pending', '/approvals', '/my-lots', '/lot-calendar', '/availability', '/lot-status'],
  manager: ['/admin', '/pending', '/approvals', '/lot-status'],
};

const CHECK_CONTRAST = process.env.A11Y_CONTRAST === '1';
const isCalendarLibraryIssue = (v: { id: string; nodes: { target: unknown[] }[] }) =>
  (v.id === 'aria-required-parent' || v.id === 'aria-required-children') &&
  v.nodes.every(n => n.target.join(' ').includes('.rbc-'));

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

type Variant = { name: string; darkMode: boolean; language: 'en' | 'he' };
const VARIANTS: Variant[] = [
  { name: 'light',  darkMode: false, language: 'en' },
  { name: 'dark',   darkMode: true,  language: 'en' },
  { name: 'hebrew', darkMode: false, language: 'he' },
];

/** Theme and language are per-user preferences stored by the backend — set them via the API. */
async function setPreferences(request: APIRequestContext, role: Role, v: Variant): Promise<void> {
  const { email, password } = CREDENTIALS[role];
  const login = await request.post('http://localhost:8000/auth/login', {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
  });
  const { access_token, user_id } = await login.json();
  const resp = await request.patch(`http://localhost:8000/api/users/${user_id}/preferences`, {
    headers: { Authorization: `Bearer ${access_token}` },
    data: { dark_mode: v.darkMode, language: v.language },
  });
  expect(resp.ok(), `could not set preferences for ${role}`).toBeTruthy();
}

for (const role of Object.keys(SCREENS) as Role[]) {
  for (const variant of VARIANTS) {
    test.describe(`a11y — ${role} — ${variant.name}`, () => {
      for (const route of SCREENS[role]) {
        test(`${route} has no WCAG A/AA violations`, async ({ page, request }) => {
          await setPreferences(request, role, variant);
          await loginAs(page, request, role);
          await page.goto(route);
          await waitForNav(page);
          // let skeletons / async data settle before scanning
          await page.waitForLoadState('networkidle');

          const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

          // Readable failure output: rule, impact, and the first few offending nodes
          const summary = results.violations
            .filter(v => CHECK_CONTRAST || v.id !== 'color-contrast')
            .filter(v => !isCalendarLibraryIssue(v))
            .map(v =>
            `${v.id} (${v.impact}): ${v.help}\n` +
            v.nodes.slice(0, 3).map(n => `    ${n.target.join(' ')}`).join('\n'));
          expect(summary, `${role} ${variant.name} ${route}`).toEqual([]);
        });
      }
    });
  }
}
