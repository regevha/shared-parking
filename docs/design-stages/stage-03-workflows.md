# Stage 3 — Workflow Reconstruction

Each workflow describes: **Actor**, **Trigger**, **Preconditions**, **Steps**, **Postconditions / Side Effects**, **Failure modes**.

---

## W1 — Submit Parking Request
- **Actor**: User, Owner, or Manager (anyone authenticated).
- **Trigger**: User fills and submits the "New Request" form.
- **Preconditions**:
  - Authenticated (valid JWT).
  - User has fewer than 5 pending requests.
  - Target date is today or later.
  - Duration is within 1–36 h.
  - `date` / `start_time` / `end_time` pass format validation.
- **Steps**:
  1. Frontend computes `end_date` + `end_time` from `date`, `start_time`, `duration`.
  2. `POST /api/requests` with payload.
  3. Backend re-validates format, past-date rule, duration, and pending-cap.
  4. Insert `ParkingRequest(status=pending)`; assign sequential ID `REQ-NNN`.
  5. Append `AuditLog(action="submitted")`.
- **Postconditions**:
  - Request visible in submitter's "My Requests" and in the global "Pending" list.
  - Request is eligible for next scheduler run.
  - No notification to owners at submission time (current design).
- **Failure modes**: 400 (validation, pending cap), 401 (auth).

---

## W2 — Auto-Approval (System Actor)
- **Actor**: APScheduler background job.
- **Trigger**: Cadence — every 15 min (`AUTO_APPROVE_INTERVAL_MINUTES`). Also triggerable on-demand by a manager.
- **Preconditions**: At least one `pending` request exists; at least one lot is `available`.
- **Steps** (per pending request, oldest-first):
  1. If request already has a `lot_id`: evaluate only that lot.
  2. Otherwise: scan lots with `status=available` (excluding `unowned*`).
  3. For each candidate lot, test:
     - No time overlap with any `approved` request on that lot.
     - The entire request span falls inside the lot owner's availability windows (day-by-day evaluation).
  4. On first lot that passes: set `status=approved`, `approved_by="auto"`, copy lot fields to request.
  5. Append `AuditLog(action="auto-assigned")`.
  6. Insert `Notification` to requester.
  7. Commit; continue to next pending request.
- **Postconditions**:
  - Request promoted or left pending for manual handling.
  - Lot assignment reflected in all views that query approved requests.
- **Failure modes**: If no lot matches, request remains `pending`; no error surfaced.

---

## W3 — Manual Approval
- **Actor**: Owner or Manager.
- **Trigger**: Clicks "Approve" on a pending request; picks a lot.
- **Preconditions**:
  - Request exists and is `pending`.
  - Caller role ∈ {owner, manager}.
  - Chosen lot is conflict-free with other approved requests (soft: availability windows are **not** enforced — manual approval overrides windows by design).
- **Steps**:
  1. `PATCH /api/requests/{id}/approve` with `{lot_id, floor, lot_owner}`.
  2. Backend re-checks conflict; 409 on conflict.
  3. Set `status=approved`, `approved_by=<current user name>`, `rejected_by_owner=false`, fill lot fields, stamp `approved_at` + `updated_at`.
  4. Append `AuditLog(action="approved", details="lot X (Floor Y)")`.
  5. Insert `Notification` to requester.
- **Postconditions**: Request moves to approved lists; requester notified.
- **Failure modes**: 403 (role), 404 (request), 400 (not pending), 409 (conflict).

---

## W4 — Rejection
- **Actor**: Owner or Manager.
- **Trigger**: Clicks "Reject" on a pending request.
- **Preconditions**: Request exists (status check not strictly enforced in router, but UI limits to pending).
- **Steps**:
  1. `PATCH /api/requests/{id}/reject`.
  2. Set `status=rejected`, `rejected_by_owner=true`, stamp `updated_at`.
  3. Append `AuditLog(action="rejected")`.
  4. Insert `Notification` to requester.
- **Postconditions**: Request terminal; visible to requester and managers.

---

## W5 — Edit Own Pending Request
- **Actor**: Requester (any role).
- **Trigger**: Edits fields on "My Requests" or request detail.
- **Preconditions**: Caller is the requester; status is `pending`.
- **Steps**:
  1. `PATCH /api/requests/{id}` with any of `date`, `start_time`, `duration`.
  2. Backend fills unchanged fields from existing record, recomputes `end_date` + `end_time`.
  3. Format + past-date validation re-applied.
  4. Stamp `updated_at`; append `AuditLog(action="updated")`.
- **Postconditions**: Request still pending; next scheduler cycle re-evaluates new slot.
- **Failure modes**: 403 (not owner), 400 (not pending or invalid times).

---

## W6 — Cancel / Delete Own Request
- **Actor**: Requester (any role); Manager can cancel anyone's via admin flows (implicit — not a distinct endpoint).
- **Trigger**: Clicks "Cancel".
- **Preconditions**:
  - Caller is the requester.
  - If status is `approved` and caller is not a manager: start time must be ≥ 2 h away (`CANCELLATION_WINDOW_HOURS`).
- **Steps**:
  1. `DELETE /api/requests/{id}`.
  2. Null out `request_id` on linked `RequestMessage` rows (audit retention).
  3. Append `AuditLog(action="cancelled")`.
  4. Delete the request row.
- **Postconditions**: Request gone; related messages preserved with detached reference; no notification emitted.
- **Failure modes**: 403 (not owner), 400 (inside cancellation window).

---

## W7 — Send / Read Messages on a Request
- **Actor**: Requester, any Owner, or any Manager.
- **Trigger**: Opens request detail; posts a message.
- **Preconditions**: Request exists.
- **Steps**:
  - **Read**: `GET /api/requests/{id}/messages` → ordered by `id`.
  - **Post**: `POST /api/requests/{id}/messages` with `{text}`; ≤ 1000 chars, non-empty (trimmed).
  - Sender snapshot (`sender_id/name/role`) captured at write time.
- **Postconditions**: Thread updated; surviving on request deletion.
- **Failure modes**: 403 (non-requester who isn't owner/manager), 404, 422 (validation).

---

## W8 — Manage Own Availability Windows
- **Actor**: Owner (and Manager, implicitly, if they own lots).
- **Trigger**: Edits the Availability Windows screen.
- **Preconditions**: Authenticated.
- **Steps**:
  1. Frontend edits JSON per weekday.
  2. `PATCH /api/users/{self-id}/preferences` with `availability_windows` JSON string.
- **Postconditions**: Next scheduler run will use the new windows for auto-approval.
- **Note**: Windows are enforced by **auto-approval only**. Manual approval bypasses them.

---

## W9 — Lot Administration
- **Actor**: Manager (primary); Owner (limited).
- **Subflows**:
  - **Create lot** — Manager: `POST /api/lots` with `id` uniqueness check.
  - **Reassign ownership** — Manager only: PATCH with `owner`/`owner_id`.
  - **Update status / blocked_until** — Manager (any lot) or Owner (own lots only).
  - **Delete lot** — Manager only.
- **Postconditions**: Lot changes propagate into scheduler eligibility + Lot Status board.

---

## W10 — User Administration
- **Actor**: Manager; self-service for non-role fields.
- **Subflows**:
  - **List users** — Manager.
  - **Update user** — Manager can change any field; user can update own name/email/password; role change is manager-only.
  - **Delete user** — Manager; self-delete forbidden. CASCADE removes `UserPreferences` + `Notifications`.
- **Side effects**: Email uniqueness re-checked on update; password hashed via bcrypt on change.

---

## W11 — CSV Bulk Import (Users / Lots)
- **Actor**: Manager.
- **Trigger**: Uploads `.csv` in Admin Panel.
- **Steps**:
  1. `POST /api/admin/import-users` or `/import-lots` with file.
  2. Parse CSV (`csv.DictReader`).
  3. Skip duplicates by email (users) or id (lots); collect per-row errors.
  4. Users default password: `password123` if not provided; default role `user`.
  5. Lots: `owner_email` resolves to `owner_id` + `owner` name if matched.
- **Postconditions**: Bulk-created rows committed; report `{imported, errors}` returned.

---

## W12 — Broadcast Notification
- **Actor**: Manager.
- **Trigger**: Admin Panel "Broadcast" action.
- **Steps**:
  1. `POST /api/notifications/broadcast` with `{audience, message}` (`audience ∈ {users, owners, both}`).
  2. Query user IDs by audience filter; insert one `Notification` per user with `📢` prefix.
- **Postconditions**: Targeted users see the notification in their bell.

---

## W13 — Read Notifications
- **Actor**: Any authenticated user.
- **Subflows**:
  - **List**: `GET /api/notifications` — newest-first, last 50.
  - **Mark one read**: `PATCH /api/notifications/{id}/read`.
  - **Mark all read**: `POST /api/notifications/read-all`.
- **Postconditions**: `is_read` flag flipped; bell count updates.

---

## W14 — Audit Trail Lookup
- **Actor**: Manager; requester of that request; involved lot owner; any owner while the request is pending.
- **Trigger**: Opens Audit Trail modal on a request.
- **Steps**:
  1. `GET /api/requests/{id}/audit`.
  2. Backend resolves the original `requester_id` from logs.
  3. Access check: manager ∨ requester ∨ involved-owner ∨ (any owner ∧ request still pending).
  4. Return logs ordered by `timestamp DESC`.
- **Postconditions**: Timeline visible; includes pre-deletion history (logs survive request deletion).

---

## W15 — Authentication & Session
- **Login**: `POST /auth/login` form-encoded (`username` = email); returns JWT + user snapshot including preferences.
- **Session start-up**: Frontend stores token in `localStorage`; on app mount calls `GET /auth/me` to re-hydrate user.
- **Logout**: Clears localStorage + context state.
- **Token lifetime**: 8 h; expiry yields 401 and forced re-login.
- **Registration**: `POST /auth/register` — default preferences row created in same transaction.

---

## W16 — Language & Theme Preferences
- **Language change**: Updates i18next, `dayjs.locale`, `<html lang/dir>`, localStorage, and DB via `PATCH /api/users/{id}/preferences`.
- **Dark mode**: Persists to DB the same way; theme applied via Ant Design `ConfigProvider` + `data-theme` attribute.
- **Hydration on login**: Preferences copied from login response into context and applied.

---

## W17 — Manual Scheduler Trigger (Manager)
- **Trigger**: Admin Panel button.
- **Endpoint**: `POST /api/config/run-auto-approval` or `POST /api/requests/run-auto-approve`.
- **Effect**: Same code path as scheduled run; returns `{approved, remaining_pending}` for feedback.
