# Stage 10 — Appendices

## Appendix A — Deferred Topics

Topics explicitly excluded from this design document, recorded here so the new project can pick them up at the right phase.

### A.1 Test Strategy
- Unit, integration, and end-to-end testing approach will be defined in a later phase.
- For reference, the current project has: 147 backend pytest cases; Playwright E2E tests (with scheduler pause/resume hooks); CRA + React Testing Library frontend tests.
- **Not in scope** for this document — no test plan, no coverage targets, no CI wiring here.

### A.2 Security Deep-Dive
- Full threat model (STRIDE or equivalent), penetration testing plan, and hardening checklist will be handled in a later phase.
- **Overview-only items covered in this doc**: JWT lifetime, bcrypt hashing, role-based authorization, permissive-by-default CORS, self-delete prevention.
- **Not covered here**: rate limiting, brute-force protection, account lockout, password complexity policy, token revocation strategy, audit log tamper-evidence, secret rotation, supply-chain review.

### A.3 Hebrew Language & RTL Layout
- The existing code supports Hebrew (`he`) with RTL via Ant Design `ConfigProvider direction="rtl"` and `<html dir>`/`<html lang>` sync.
- `react-big-calendar` is LTR-only and remains LTR even under Hebrew mode.
- **Out of scope** for the new project per user direction. If Hebrew is reintroduced later, evaluate calendar library alternatives and complete RTL passes on custom CSS.

### A.4 Pending TODOs from the Existing Project
The current project's CLAUDE.md lists the following open items. They are **not** inherited by the new project unless consciously chosen. Recorded here for visibility:

1. Tooltip on narrow overlapping calendar events.
2. Full audit-trail UI (DB columns exist).
3. Remove intra-day time-of-day restrictions; allow full 36-h multi-day.
4. Hide requests starting before "yesterday" from non-admin tables.
5. Invert lot availability — default to blocked; windows opt-in to sharing.
6. Availability Windows UI work (possibly merging with NotificationWindows).
7. Accessibility: `role="button"`, `tabIndex`, `aria-label` on calendar navigation.
8. Reusable component extraction (`<StatsBar />`, `<InfoBanner />`, `<PageWrapper />`).
9. Skeleton loading states instead of spinners.
10. Mobile card views for AdminPanel tables.
11. Blackout-window enforcement (env vars exist but not wired).
12. Stale-reference cleanup for `lot_id` on deleted lots.

### A.5 Other Features Not Expanded in the Document Body
- **CSV bulk import** (users and lots) — current implementation notes:
  - Users: columns `name,email,role,password`; default password `password123`, default role `user`.
  - Lots: columns `id,floor,floor_label,owner_email`; `owner_email` resolves to `owner_id` + `owner` name.
  - Duplicate emails / lot IDs are skipped with per-row error messages.
- **Broadcast notifications** — manager only; audiences `users`, `owners`, `both`; messages prefixed with 📢 at write time.
- **Manual scheduler trigger** — manager-only endpoints returning `{approved, remaining_pending}` for feedback.

---

## Appendix B — Demo Data Reference

The current seed (`backend/seed.py`) creates a simplified dataset:

**Users** (all password `password123`):
| ID | Name | Email | Role |
|---|---|---|---|
| O1 | Sarah | o1@parking.dev | owner |
| O2 | Mike | o2@parking.dev | owner |
| O3 | Lisa | o3@parking.dev | owner |
| A1 | David | a1@parking.dev | manager |
| A2 | Emma | a2@parking.dev | manager |

**Lots** (10 total across 3 floors):
- Floor 1 (F1): LOT-101-A, LOT-101-B, LOT-101-C, LOT-101-D (Sarah); LOT-102 (Mike).
- Floor 2 (F2): LOT-201 (Lisa), LOT-202 (Mike).
- Floor 3 (F3): LOT-301 (Sarah), LOT-302 (Lisa), LOT-303 (Mike — `unavailable`).

**Requests** (30 total): a mix of approved (past + upcoming), rejected, and pending, including several multi-day examples (up to 36 h) to exercise scheduler boundary cases.

**Owner availability**: default 00:00–23:59 on all seven weekdays — effectively 24/7 availability.

**Note**: the current `CLAUDE.md` mentions 21 users / 17 lots — that reflects an earlier seed. The authoritative seed today is what is described above.

---

## Appendix C — Glossary

- **Availability Window** — an owner-defined JSON entry `{id, startTime, endTime}` indicating when their lots may be auto-assigned on a given weekday.
- **Audit Trail** — per-request chronological log of actions (submitted / approved / rejected / cancelled / auto-assigned / updated).
- **Cancellation Window** — the forbidden zone before `start_time` during which an approved request cannot be self-cancelled (2 h default).
- **Conflict** — two approved requests on the same lot whose time spans overlap.
- **Lot** — a physical parking space with an ID, floor, owner, and status.
- **Lot Owner** — a user with `owner` role who owns one or more lots.
- **Manager** — administrative role with full privileges.
- **Pending Cap** — the maximum number of pending requests one user may hold (5).
- **Requester** — the user who submitted a particular parking request.
- **RBAC** — Role-Based Access Control; see Stage 4 matrix.

---

## Appendix D — Configuration Reference

See Stage 9 "Configuration (env vars)" for the authoritative table. In summary, all configurable limits (pending cap, durations, cancellation window, scheduler cadence, JWT lifetime, CORS) are env-driven with sane development defaults.
