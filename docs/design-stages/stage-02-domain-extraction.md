# Stage 2 — Domain Extraction

Structured domain model derived from Stage 1 inventory.

## Entities

### User
- Fields: `id`, `name`, `email` (unique), `password_hash`, `role`, `created_at`.
- One-to-one with `UserPreferences` (CASCADE delete).
- Roles form a privilege ladder: `user` ⊂ `owner` ⊂ `manager`.

### UserPreferences
- Per-user: `dark_mode`, `language` (en|fr|he), `availability_windows` (JSON), `notification_windows` (JSON).
- Availability windows shape: `weekday → [{id, startTime, endTime}, …]`. Drives auto-approval eligibility.

### Lot
- Identity: `id`, `floor`, `floor_label`.
- Ownership: `owner` (display name, denormalised) + `owner_id` (FK).
- Status: `available | blocked | unowned | unowned-blocked`.
- Optional `blocked_until` timestamp.
- Audit: `created_at`, `updated_at`.

### ParkingRequest
- Identity: `id` (sequential `REQ-NNN`).
- Requester snapshot: `requester_id`, `requester_name`, `requester_role`.
- Time: `date`, `start_time`, `end_date`, `end_time`, `duration` (1–36 h).
- Status: `pending | approved | rejected` + `rejected_by_owner` flag.
- Assignment (populated on approval): `lot_id`, `floor`, `lot_owner`, `approved_at`, `approved_by` (`"auto"` or owner name).
- Timeline: `submitted_at`, `updated_at`.

### RequestMessage
- Threaded conversation attached to a request.
- `request_id` nullable with `SET NULL` on parent delete (audit retention).
- Sender snapshot: `sender_id`, `sender_name`, `sender_role`.
- Content: `text` (≤ 1000 chars), `sent_at`.

### AuditLog
- Per-request event stream.
- Actions: `submitted | approved | rejected | cancelled | auto-assigned | updated`.
- Captures actor, original `requester_id`, `details`, `timestamp`.

### Notification
- Per-user inbox, `is_read` flag, newest-first, last 50 surfaced.
- Sources: auto-approval, manual approval, rejection, manager broadcast.

## Request Status State Machine
- `pending` → `approved` (by owner/manager OR auto-scheduler).
- `pending` → `rejected` (by owner/manager).
- `pending` → deleted (requester cancellation).
- `approved` → deleted (requester within window; manager anytime).
- `rejected` is terminal.
- No state regression — only `pending` can be approved/rejected/edited.

## Lot Status State Machine
- `available` ↔ `blocked` (owner or manager on own/any lot).
- `unowned` ↔ `unowned-blocked` (manager only).
- Ownership reassignment: manager only.

## Role/Permission Matrix
| Action | User | Owner | Manager |
|---|---|---|---|
| Submit request | ✓ | ✓ | ✓ |
| View own requests | ✓ | ✓ | ✓ |
| View all pending/approved | ✓ | ✓ | ✓ |
| View all requests (incl. rejected) | ✗ | ✗ | ✓ |
| Approve / reject | ✗ | ✓ | ✓ |
| Edit own pending | ✓ | ✓ | ✓ |
| Cancel own within window | ✓ | ✓ | ✓ |
| Cancel approved bypassing window | ✗ | ✗ | ✓ |
| Update own lot status | — | ✓ | ✓ |
| Create / delete / reassign lots | ✗ | ✗ | ✓ |
| Manage users | ✗ | ✗ | ✓ |
| Change own name/email/password | ✓ | ✓ | ✓ |
| Change role | ✗ | ✗ | ✓ |
| Delete self | ✗ | ✗ | ✗ |
| Broadcast notifications | ✗ | ✗ | ✓ |
| CSV import | ✗ | ✗ | ✓ |
| View audit log | own + involved + any-pending-as-owner | ✓ | ✓ all |

## Business Rules Catalogue
1. Pending cap: 5 per user.
2. Duration: 1–36 h.
3. Date cannot be in the past.
4. HH:MM / YYYY-MM-DD regex-enforced.
5. Auto-approval cadence: 15 min.
6. Cancellation window: 2 h before start (approved, non-manager).
7. JWT lifetime: 8 h.
8. Approval requires `pending`.
9. Edit requires owner-of-request + pending.
10. Availability windows enforced on auto-approval; bypassed on manual approval.
11. Conflict = standard overlap on same lot among approved.
12. Owners modify only `status` and `blocked_until` on their own lots.
13. Manager self-delete forbidden.
14. Message text: non-empty, ≤ 1000 chars.
15. Language allowlist: en|fr|he.
16. Email uniqueness on update.
17. Messages survive request deletion (`request_id = NULL`).
18. Blackout window (`BLACKOUT_START`/`END`) — configured but not enforced (→ appendix).
19. Lot ID uniqueness on create.
20. Notifications: newest 50 surfaced.

## Entity Relationships
- User (1) ── (1) UserPreferences [CASCADE].
- User (1) ── (0..n) Lot [via `owner_id`, soft ref].
- User (1) ── (0..n) ParkingRequest [via `requester_id`, soft ref].
- User (1) ── (0..n) Notification [CASCADE].
- ParkingRequest (1) ── (0..n) RequestMessage [SET NULL].
- ParkingRequest (1) ── (0..n) AuditLog [soft ref — survives deletion].
- Lot (1) ── (0..n) ParkingRequest [via `lot_id`, after approval].

## Core Domain Concepts
- **Actors**: Requester, Lot Owner, Manager, Auto-Scheduler (system actor).
- **Artifacts**: Request, Lot, Approval, Availability Window, Notification, Audit Entry, Message Thread.
- **Time model**: UTC ISO timestamps; date/time transported as strings.
- **Two-tier approval**: automatic when conflict-free + within windows; manual fallback with override power.
