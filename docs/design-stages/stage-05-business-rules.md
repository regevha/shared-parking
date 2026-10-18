# Stage 5 — Business Rules Catalogue

Complete enumeration of implicit and explicit business rules, each with source references and notes for the new-project team.

---

## R1 — Pending Request Cap
- **Rule**: A user may hold at most **5 pending requests** at any time.
- **Scope**: `POST /api/requests`.
- **Config**: `MAX_PENDING_REQUESTS` env var (default 5).
- **Source**: `backend/routers/requests.py` in `create_request`.
- **Rationale**: Prevents queue flooding.
- **Failure**: HTTP 400.

## R2 — Duration Bounds
- **Rule**: Request duration must be between **1 and 36 hours** (inclusive).
- **Scope**: `POST /api/requests` (Pydantic `ParkingRequestCreate`).
- **Config**: `MIN_REQUEST_DURATION_HOURS`, `MAX_REQUEST_DURATION_HOURS`.
- **Source**: `backend/schemas.py` `validate_time_range`.
- **Note**: 36 h enables multi-day requests (e.g. weekend).

## R3 — Past-Date Rejection
- **Rule**: `date` cannot be before today (server local date).
- **Scope**: Create + Update.
- **Source**: `backend/schemas.py` `validate_date`.

## R4 — Format Validation
- **Rule**: `date` matches `YYYY-MM-DD`; `start_time` / `end_time` match `HH:MM` (24 h, minutes 00–59).
- **Source**: `_DATE_RE`, `_TIME_RE` in `schemas.py`.

## R5 — End-Time Derivation / Consistency
- **Rule**: If caller does not provide `end_date` / `end_time`, server derives them from `date + start_time + duration`. If caller provides them, they must match the derived values to within 60 s.
- **Source**: `ParkingRequestCreate.validate_time_range`.

## R6 — Auto-Approval Cadence
- **Rule**: Auto-approval runs **every 15 minutes**.
- **Config**: `AUTO_APPROVE_INTERVAL_MINUTES`.
- **Source**: `backend/scheduler.py`.

## R7 — Auto-Approval Eligibility
- **Rule**: Auto-approval will promote a pending request to approved iff:
  1. A lot with `status=available` exists (preferred: any pre-assigned lot).
  2. The request has no time overlap with any `approved` request on that lot.
  3. The entire request span lies within the lot owner's availability windows.
- **Evaluation order**: Oldest `submitted_at` first.
- **Source**: `scheduler.run_auto_approval`, `_has_conflict`, `_is_outside_availability`.

## R8 — Conflict Definition
- **Rule**: Two requests on the same lot conflict if their `[start, end]` ranges strictly overlap (`new_start < r_end AND new_end > r_start`).
- **Source**: `_has_conflict` in `routers/requests.py`.

## R9 — Availability Windows
- **Shape**: `{ weekday: [{ id, startTime, endTime }, …] }` stored as JSON string on `UserPreferences.availability_windows`.
- **Coverage check**: Day-by-day; multi-day requests require coverage on each affected weekday. A segment is "covered" iff `segment_start >= slot.start AND segment_end <= slot.end`.
- **Default**: Seeded owners get 00:00–23:59 on every day.
- **Enforcement**: Auto-approval only. **Manual approval bypasses windows** intentionally (override).
- **Source**: `_is_outside_availability`, `seed.py`.

## R10 — Manual Approval Conflict Check
- **Rule**: Manual approval checks conflicts but NOT availability windows.
- **Rationale**: Gives owners/managers override authority.
- **Source**: `approve_request` in `routers/requests.py`.

## R11 — Edit Restriction
- **Rule**: Only the original requester can edit, and only while `status=pending`.
- **Source**: `update_request`.

## R12 — Cancellation Window
- **Rule**: Approved requests cannot be cancelled by the requester within **2 hours** of `start`. Managers bypass.
- **Config**: `CANCELLATION_WINDOW_HOURS` (default 2).
- **Source**: `delete_request`.

## R13 — Message Audit Retention
- **Rule**: When a request is deleted, related messages are preserved with `request_id = NULL`.
- **Mechanism**: FK is nulled explicitly in `delete_request` before row removal (SQLite does not enforce FK `ON DELETE SET NULL` without `PRAGMA foreign_keys=ON`).
- **Source**: `delete_request`, `models.RequestMessage` comment.

## R14 — Message Content Constraints
- **Rule**: Text must be non-empty after trimming; ≤ 1000 characters.
- **Source**: `MessageCreate.validate_text`.

## R15 — Approval Pre-state Requirement
- **Rule**: Only `pending` requests can be approved.
- **Source**: `approve_request`.

## R16 — Lot ID Uniqueness
- **Rule**: Lot `id` is the primary key; creating a duplicate returns 400.
- **Source**: `create_lot`.

## R17 — Owner Lot-Update Scope
- **Rule**: An owner updating a lot may only change `status` and `blocked_until`, and only on lots where `owner_id == current_user.id`.
- **Source**: `update_lot`.

## R18 — Manager-Only Lot Lifecycle
- **Rule**: Only managers may create, delete, or reassign ownership of lots.
- **Source**: `create_lot`, `delete_lot`, `update_lot`.

## R19 — User Update Rules
- **Self**: May update name / email / password. Cannot change own role.
- **Manager**: May update any user and any field.
- **Source**: `update_user`.

## R20 — Email Uniqueness
- **Rule**: Email is globally unique; updates reject duplicates.
- **Source**: `update_user`, `register`.

## R21 — Password Hashing
- **Rule**: bcrypt with per-password salt; 8-char minimum is **not** enforced (only non-null).
- **Source**: `auth.hash_password`, `verify_password`.

## R22 — Self-Delete Prevention
- **Rule**: Managers cannot delete their own account (HTTP 400).
- **Rationale**: Prevents locking the system out.
- **Source**: `delete_user`.

## R23 — Cascade Deletes
- **User → UserPreferences**: CASCADE.
- **User → Notification**: CASCADE.
- **Request → Message**: SET NULL (audit retention, see R13).
- **Lot → Request**: no cascade; `lot_id` on requests becomes a stale reference if a lot is deleted.

## R24 — JWT Lifetime
- **Rule**: Access token expires after 480 min (8 h).
- **Config**: `ACCESS_TOKEN_EXPIRE_MINUTES`.
- **Source**: `auth.create_access_token`.

## R25 — Language Allowlist
- **Rule**: `language` ∈ {`en`, `fr`, `he`}.
- **Source**: `schemas.PreferencesUpdate.validate_language`.
- **New-project note**: Hebrew/RTL is out of scope — expected allowlist becomes `{en, fr}`.

## R26 — Notification Broadcast Audience
- **Rule**: `audience ∈ {users, owners, both}`. `users` → role `user` only; `owners` → role `owner` only; `both` (or any unrecognised value) → **all users including managers** (no role filter applied).
- **Note**: The in-source comment claims "owners + users" but the code contains no filter excluding managers. The new project should make this explicit.
- **Source**: `broadcast_alert`.

## R27 — Notification Inbox Cap
- **Rule**: GET endpoint returns at most 50 most-recent notifications.
- **Source**: `get_notifications`.

## R28 — Request ID Generation
- **Rule**: Sequential `REQ-NNN`, padding preserved and growable; fallback to `REQ-<UUID6>` on parse error.
- **Source**: `_generate_id`.

## R29 — Audit Trail Access
- **Rule**: Manager (always); requester (own); involved lot owner; any owner if request is still pending.
- **Source**: `get_request_audit`.

## R30 — Manager-Only Scheduler Trigger
- **Rule**: Manual auto-approval run is restricted to managers.
- **Source**: `routers/config.py`, `routers/requests.py`.

## R31 — Approver Identity
- **Rule**: `approved_by = "auto"` when scheduler promotes; otherwise the approving user's name.
- **Source**: `scheduler.run_auto_approval`, `approve_request`.

## R32 — Rejected-By-Owner Flag
- **Rule**: `rejected_by_owner=true` on rejection; reset to `false` on (re-)approval.
- **Source**: `reject_request`, `approve_request`.

## R33 — CSV Import Defaults
- **Users**: missing `password` → `password123`; missing `role` → `user`.
- **Lots**: `owner_email` resolved to `owner_id` + `owner` name; lot `status` defaults to `available`.
- **Source**: `routers/admin.py`.

---

## Rules NOT Enforced in Code (candidates for new project)

### BR-Blackout
- System config exposes `BLACKOUT_START` / `BLACKOUT_END` (default `22:00` / `06:00`) through `/api/config`, but no endpoint currently rejects requests inside the blackout window. Treat as a planned feature.

### BR-StaleLotReferences
- No cleanup of request `lot_id` pointing at a deleted lot; UI must tolerate.

### BR-RejectPendingOnly
- `reject_request` does not explicitly assert `status == pending`. The UI is currently the only enforcement point.

### BR-RequestTimeUniqueness
- No global rule preventing a user from having multiple approved requests in the same window across different lots.

### BR-HistoricalRequestRetention
- Pending TODO: "Hide old requests from table views". Not enforced; UI filter pending.
