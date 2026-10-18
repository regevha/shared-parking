# Stage 13 — Self-Review

Spot-check of claims in the assembled document against the code. Each item records: claim → source → verdict.

## Verified (no changes needed)

| # | Claim | Source | Verdict |
|---|---|---|---|
| 1 | JWT lifetime is 8 h (480 min). | `backend/auth.py` `ACCESS_TOKEN_EXPIRE_MINUTES=480` | ✓ |
| 2 | Max 5 pending requests per user. | `routers/requests.py` `create_request` | ✓ |
| 3 | Duration 1–36 h. | `schemas.py` `validate_time_range` | ✓ |
| 4 | Cancellation window 2 h; managers bypass. | `routers/requests.py` `delete_request` | ✓ |
| 5 | Auto-approval cadence 15 min. | `scheduler.py` interval | ✓ |
| 6 | Message text non-empty, ≤ 1000 chars. | `schemas.py` `MessageCreate.validate_text` | ✓ |
| 7 | Notifications capped at 50 most recent. | `routers/notifications.py` `get_notifications` | ✓ |
| 8 | Manual approval bypasses availability windows. | `routers/requests.py` `approve_request` (no `_is_outside_availability` call; comment in source) | ✓ |
| 9 | Conflict = strict time overlap on same lot among approved. | `_has_conflict` | ✓ |
| 10 | Audit actions: submitted, approved, rejected, cancelled, auto-assigned, updated. | `models.py` `AuditLog.action` comment | ✓ |
| 11 | Self-delete forbidden; CASCADE removes preferences & notifications on user delete. | `routers/users.py` + `models.py` | ✓ |
| 12 | Request IDs sequential `REQ-NNN` with UUID fallback. | `_generate_id` | ✓ |
| 13 | Messages preserved with `request_id = NULL` after request deletion (manual null-out). | `delete_request` + `models.RequestMessage` comment | ✓ |
| 14 | Seed: 5 users / 10 lots / ~30 requests; 24/7 owner availability. | `seed.py` | ✓ |
| 15 | `get_pending` / `get_approved` available to any authenticated user. | `routers/requests.py` (no role guard) | ✓ |
| 16 | Rejection endpoint does not enforce `pending` state. | `reject_request` (no status check) | ✓ (documented as a gap) |
| 17 | Manager-only scheduler trigger. | `routers/config.py` + `routers/requests.py` | ✓ |
| 18 | Dev-only scheduler pause/resume endpoints exist. | `main.py` `/internal/scheduler/*` | ✓ |

## Discrepancies Found

### D1 — Broadcast audience: "both" includes managers

- **Doc claim** (§5 and Stage 5 R26): audience `both` targets "owners + users (managers excluded)".
- **Actual code** (`routers/notifications.py`): when `audience` is `"both"` or any value other than `"owners"`/`"users"`, **no role filter is applied** — so the broadcast is delivered to every user, including managers. The in-source comment says "owners + users" but the code doesn't enforce it.
- **Severity**: Low (correctness of documentation).
- **Fix applied**: Updated the markdown source to reflect actual behaviour.

### D2 — User demo seed drift

- **Doc claim** (§15 Operational and Appendix B): seed creates 5 users / 10 lots (acknowledging that the old `CLAUDE.md` mentions 21 users / 17 lots).
- **Actual code** (`seed.py`): matches the document — 5 users, 10 lots, ~30 requests.
- **Severity**: None; the doc already flags the discrepancy vs. `CLAUDE.md`.
- **Fix applied**: No change needed.

## Items Re-Checked and Confirmed Accurate

- Lot status enum values: `available`, `blocked`, `unowned`, `unowned-blocked` — matches `models.LotStatus`.
- Owner lot-update scope restricted to `status` + `blocked_until` — `routers/lots.py` `update_lot`.
- Email uniqueness on update — `routers/users.py` `update_user`.
- Approver identity: `"auto"` for scheduler; user name for manual — `scheduler.py` and `approve_request`.
- `rejected_by_owner` reset on re-approval — `approve_request` sets `False`.
- Availability windows day-by-day coverage check — `_is_outside_availability` loops through days.
- Audit-trail access logic (manager / requester / involved owner / any-owner-while-pending) — `get_request_audit`.

## Overall Verdict

One documentation error (D1) identified and corrected. All other spot-checked claims match the implementation. The document faithfully represents the shared-parking domain as implemented and is ready to serve as the base for the new project.
