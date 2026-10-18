# Stage 8 — Internationalisation (English / French)

Per scope, Hebrew and RTL handling are explicitly out of scope and are relegated to the Appendix of deferred topics (Stage 10). This chapter describes the EN/FR path.

---

## Languages in Scope
- **English (`en`)** — default, fallback for missing keys.
- **French (`fr`)** — full translation parity expected.

## Stack
- **Library**: `i18next` + `react-i18next`.
- **Date formatting**: `dayjs` with `dayjs/locale/fr` imported at app start.
- **Ant Design locale**: `antd/locale/en_US` / `fr_FR`, passed into `ConfigProvider`.

## Translation File Structure
- One JSON per language under `src/i18n/`.
- Namespaces (flat keys grouped by top-level prefix): `nav`, `common`, `login`, `myRequests`, `pendingRequests`, `approvals`, `requestForm`, `requestDetail`, `notificationWindows`, `adminPanel`, `calendarView`, `lotCalendarView`, `lotStatusBoard`, `myLots`, `app` — 12 namespaces total.
- Keys are read via `t('namespace.key')`. Missing keys fall back to English.

## Language Detection & Persistence
- On first load: read localStorage key `parking_language`; default `en` if absent.
- On login: overwrite with `user.preferences.language` from backend response.
- On language change:
  1. `i18n.changeLanguage(next)`
  2. `dayjs.locale(next)`
  3. `document.documentElement.lang = next`
  4. `storeLanguage(next)` → localStorage
  5. `PATCH /api/users/{id}/preferences` fire-and-forget.

## Allowlist Enforcement
- Backend: `language` field in `PreferencesUpdate` validated against `{'en', 'fr', 'he'}` in current implementation. **For the new project**, the allowlist should be `{'en', 'fr'}`.

## Ant Design Integration
- `<ConfigProvider locale={antdLocale} …>` wraps the app.
- `antdLocale` is derived from the current language setting.
- Ant Design handles its own labels (pagination, date pickers, empty states).

## Calendar Localisation
- `react-big-calendar` uses `dayjsLocalizer`. Because `dayjs.locale()` is set on change, all calendar weekday/month labels localise automatically.

## Key Design Decisions
1. **DB-persisted language, not just localStorage**: enables the same language preference across devices for the same user.
2. **Flat namespaced JSON, not plural/context files**: trades granularity for simplicity; fine for UI strings.
3. **Fire-and-forget backend sync**: avoids blocking the UI on the preference write.
4. **No translation catalog tooling (e.g. Crowdin)**: manual JSON edits — acceptable at current scale, but the new project should consider a pipeline if more languages arrive.

## Known Gaps (new-project opportunities)
- **No pluralisation rules** yet (`count_one`/`count_other` patterns absent).
- **No parameterised dates or numbers** beyond dayjs default formatting.
- **No lazy-loading** of translation bundles — all three languages ship in the initial JS payload.
- **No missing-key reporting** in production — silent English fallback only.

## Scope Reminder
RTL layout, Hebrew translations, and bidirectional layout considerations for `react-big-calendar` are **explicitly excluded** from this design per the agreed scope. They appear only in the Stage 10 appendix as deferred topics.
