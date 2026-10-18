# Shared Parking — System Design Document

> **Audience**: Product Manager and Software Architect review. This document is the basis for a new development project targeting the same domain (shared parking slot management).

> **Scope notes**:
> - Emphasis is on **domain logic**.
> - Test strategy, security deep-dive, RTL/Hebrew support, and the existing project's pending TODOs are **deferred** to a later phase — see Appendix A.
> - API shape is documented by **convention**, not endpoint-by-endpoint.
> - Business rules are documented in a **technical section**, not as first-class functional requirements.
> - Diagrams are **textual** throughout.

---

## Table of Contents

1. [Purpose & Audience](#1-purpose--audience)
2. [Executive Summary](#2-executive-summary)
3. [Glossary](#3-glossary)
4. [Domain Model](#4-domain-model)
5. [Roles & Permissions](#5-roles--permissions)
6. [Core Workflows](#6-core-workflows)
7. [Status State Machines](#7-status-state-machines)
8. [Business Rules (Technical)](#8-business-rules-technical)
9. [Screens & Navigation](#9-screens--navigation)
10. [Internationalisation (EN / FR)](#10-internationalisation-en--fr)
11. [Technical Architecture](#11-technical-architecture)
12. [API Shape & Conventions](#12-api-shape--conventions)
13. [Data Persistence & Integrity](#13-data-persistence--integrity)
14. [Authentication (Overview)](#14-authentication-overview)
15. [Operational Concerns](#15-operational-concerns)
16. [Appendices](#16-appendices)

---

## 1. Purpose & Audience

This document describes the shared-parking domain, the behaviours the existing implementation encodes, and the architectural shape it uses, so that the new project team can make informed design decisions. It is intended for a **product manager** (who needs to understand flows, roles, and business rules) and a **software architect** (who needs to understand boundaries, invariants, and extension points). It is not a migration plan, not an implementation spec, and not a test plan.

---

## 2. Executive Summary

The shared-parking system coordinates parking-slot requests between three human actors — *Users*, *Lot Owners*, and *Managers* — and one system actor — the *Auto-Scheduler*. Users submit time-bound parking requests. The Auto-Scheduler promotes conflict-free requests within an owner's advertised availability windows every 15 minutes. Requests the scheduler cannot resolve are handled manually by owners or managers, who can override availability constraints when they choose. Rejections, cancellations, and administrative changes flow through the same role model.

The domain centres on five entities: **User**, **UserPreferences**, **Lot**, **ParkingRequest**, and **RequestMessage**, augmented by **AuditLog** and **Notification** for operational traceability and communication.

Key characteristics:

- **Two-tier approval** — automatic when conflict-free, manual with override authority.
- **Availability windows** — an owner-driven constraint enforced only at auto-approval.
- **Audit-first** — every material change emits an audit entry; messages outlive their parent request for retention.
- **Role ladder** — privileges inherit (`user` ⊂ `owner` ⊂ `manager`).
- **Stateless API** — JWT-authenticated, REST/JSON, no server session.

---

## 3. Glossary

- **Actor** — the initiator of a workflow; either a human (User / Owner / Manager) or the system (Auto-Scheduler).
- **Audit Trail** — per-request chronological record of material actions.
- **Availability Window** — an owner-defined time range on a specific weekday during which auto-approval may assign their lots.
- **Cancellation Window** — the forbidden zone before an approved request's start time during which the requester cannot self-cancel (currently 2 h).
- **Conflict** — time overlap between two approved requests on the same lot.
- **Lot** — a physical parking space with an identifier, floor, owner, and status.
- **Manager** — administrative role; superset of Owner privileges.
- **Owner** — user who owns one or more lots; has approval authority.
- **Pending Cap** — the per-user maximum of simultaneously pending requests.
- **Request** — a submitted intent to use a parking slot for a defined time range.
- **Scheduler / Auto-Scheduler** — background job that promotes eligible pending requests.
- **User** — the default role; submits and manages their own requests.

---

## 4. Domain Model

### 4.1 Entities

#### User
Identity record with `id`, `name`, `email` (unique), `password_hash`, `role`, and a creation timestamp. Linked one-to-one to `UserPreferences` (cascade-delete). Roles form a privilege ladder.

#### UserPreferences
Per-user settings that drive real backend behaviour, not only UI state:
- `dark_mode` — UI theme.
- `language` — from the allowlist (`en`, `fr`; current code includes `he` which is out of scope).
- `availability_windows` — JSON of `weekday → [{id, startTime, endTime}, …]`. Enforced by the Auto-Scheduler.
- `notification_windows` — JSON of per-weekday notification preferences.

#### Lot
A physical parking slot with `id`, `floor`, `floor_label`, an ownership pair (`owner` display name + `owner_id`), a status from `available | blocked | unowned | unowned-blocked`, and an optional `blocked_until` timestamp.

#### ParkingRequest
A time-bound reservation intent with a sequential identifier (`REQ-NNN`). Carries a requester snapshot (ID, name, role at submission), a time range (`date`, `start_time`, `end_date`, `end_time`, `duration` in hours), a `status`, and (once approved) lot assignment fields and approver identity (`"auto"` or the approving user's name).

#### RequestMessage
Threaded conversation attached to a request. Sender fields are denormalised at write time. The foreign key to the parent request is nullable and set to `NULL` when the request is deleted — messages survive for audit retention.

#### AuditLog
Per-request event stream with actions `submitted | approved | rejected | cancelled | auto-assigned | updated`, actor identity, original requester identity, optional details, and timestamp. Audit entries survive request deletion.

#### Notification
Per-user inbox with `is_read` and `created_at`. Sources include auto-approval outcomes, manual approvals, rejections, and manager broadcasts.

### 4.2 Relationships
- User 1—1 UserPreferences (cascade delete).
- User 1—0..n Lot (via `owner_id`; soft reference, no DB FK enforcement).
- User 1—0..n ParkingRequest (via `requester_id`; soft reference).
- User 1—0..n Notification (cascade delete).
- ParkingRequest 1—0..n RequestMessage (SET NULL on parent delete — audit retention).
- ParkingRequest 1—0..n AuditLog (soft reference — entries survive deletion).
- Lot 1—0..n ParkingRequest (via `lot_id`, populated only after approval).

### 4.3 Core Concepts
- **Actors**: Requester, Lot Owner, Manager, Auto-Scheduler.
- **Artifacts**: Request, Lot, Approval, Availability Window, Notification, Audit Entry, Message Thread.
- **Time model**: UTC ISO 8601 timestamps; date/time transported as strings (`YYYY-MM-DD`, `HH:MM`).
- **Approval tiers**: automatic when conflict-free AND inside availability; manual fallback that can override windows.

---

## 5. Roles & Permissions

### 5.1 Role Ladder
- **User** — submits requests, edits and cancels own pending, views shared boards.
- **Owner** — user + lot ownership + approve/reject + own-lot management + availability windows.
- **Manager** — owner + full user / lot administration + CSV imports + broadcast + unrestricted audit access + manual scheduler trigger.

Authorization is enforced server-side via FastAPI dependencies (`get_current_user`, `require_owner`, `require_manager`) plus resource-level ownership checks inside handlers. Frontend route visibility mirrors the same matrix but is advisory only.

### 5.2 Consolidated Permission Matrix

(Structured by resource for architect review; see Stage 4 file for the full source-referenced version.)

**Requests**
| Action | User | Owner | Manager |
|---|---|---|---|
| Create / view own / view pending-approved lists | ✓ | ✓ | ✓ |
| View all (incl. rejected) | ✗ | ✗ | ✓ |
| Approve, Reject | ✗ | ✓ | ✓ |
| Edit own pending | ✓ | ✓ | ✓ |
| Cancel own — within window (approved) | ✗ | ✗ | ✓ |
| Cancel own — outside window | ✓ | ✓ | ✓ |
| View audit trail | own / involved / pending-as-owner | ✓ | ✓ all |
| Trigger auto-approval | ✗ | ✗ | ✓ |

**Lots**
| Action | User | Owner | Manager |
|---|---|---|---|
| List all / list own (`/mine`) | read-all / — | ✓ / ✓ | ✓ / ✓ |
| Create / delete / reassign ownership | ✗ | ✗ | ✓ |
| Update status, `blocked_until` on own lot | — | ✓ | ✓ |
| Update any lot | ✗ | ✗ | ✓ |

**Users**
| Action | User | Owner | Manager |
|---|---|---|---|
| List all | ✗ | ✗ | ✓ |
| View profile | self only | self only | ✓ |
| Update own name/email/password | ✓ | ✓ | ✓ |
| Update role | ✗ | ✗ | ✓ |
| Delete self | ✗ | ✗ | ✗ |
| Delete other | ✗ | ✗ | ✓ |

**Messages, Notifications, Preferences, Admin** — see Stage 4 for per-action entries.

### 5.3 Authorization Cross-Cuts
- Self-vs-other checks are present in users, preferences, and audit endpoints.
- Ownership derivation is based on `requester_id` (requests), `owner_id` (lots), and `user.id == path id` (users and preferences).
- The rejection endpoint does not explicitly require `pending` state — UI is the enforcement point today. This is an opportunity in the new project to tighten.

---

## 6. Core Workflows

Each workflow below lists actor, trigger, preconditions, steps, postconditions, and failure modes. Full details are in Stage 3; this chapter gives the narrative needed for domain review.

### 6.1 Submit Request
User submits a time-bound request. Server validates format, past-date, duration (1–36 h), and the 5-pending cap. Inserts a `pending` row, assigns sequential ID, writes `submitted` audit. No owner notification at submission.

### 6.2 Auto-Approval (System)
Every 15 minutes, the scheduler scans pending requests oldest-first. For each, it tries the assigned lot (if any) or any lot with status `available`, and approves iff (a) no time overlap with existing approvals on that lot, and (b) the full span is inside the lot owner's availability windows. On match it assigns the lot, stamps approver as `"auto"`, writes an `auto-assigned` audit entry, and notifies the requester.

### 6.3 Manual Approval
Owner or manager picks a pending request and a lot. The conflict check runs; availability windows are **not** enforced — manual approval is an intentional override. On success the status moves to `approved`, the lot is assigned, and the requester is notified.

### 6.4 Rejection
Owner or manager rejects a pending request. Status moves to `rejected`, `rejected_by_owner` flag set, audit written, requester notified.

### 6.5 Edit Own Pending
Requester may modify `date`, `start_time`, and `duration`. The server recomputes `end_date`/`end_time`, re-validates, stamps `updated`, and leaves the request in `pending`.

### 6.6 Cancel / Delete
Requester cancels. Approved requests within 2 h of start cannot be self-cancelled unless the caller is a manager. Messages on the request are preserved (`request_id` set to NULL) for retention, then the request row is deleted.

### 6.7 Messages
The requester, any owner, or any manager may read and post messages on any request. Text is non-empty and ≤ 1000 characters. Threads survive request deletion.

### 6.8 Availability Windows
Owners edit weekday-keyed JSON in their preferences. The scheduler consumes this on the next tick. Manual approval bypasses the windows by design.

### 6.9 Lot Administration
Create, delete, and ownership reassignment are manager-only. Owners may change only `status` and `blocked_until` on their own lots. Managers may change any lot.

### 6.10 User Administration
Managers list, view, update, and delete users. Self-delete is forbidden. Role changes are manager-only. Users can update their own name, email (uniqueness re-checked), and password.

### 6.11 CSV Bulk Import
Manager uploads a CSV. Users default to `password123` / role `user` when fields are absent. Lots resolve `owner_email` to `owner_id` + display name. Duplicates are skipped with per-row errors.

### 6.12 Broadcast Notification
Manager chooses an audience (`users`, `owners`, `both`) and a message. One `Notification` row is inserted per target, prefixed with 📢.

### 6.13 Notifications
Any user lists their newest 50 notifications, marks one read, or marks all read.

### 6.14 Audit Trail Lookup
Access is granted to a manager, the requester, the involved lot owner, or any owner while the request is still pending. Entries are returned newest-first and survive request deletion.

### 6.15 Authentication & Session
Form-encoded login returns a JWT and user snapshot. The browser persists the token in `localStorage` and re-validates on mount via `GET /auth/me`. Token lifetime is 8 hours.

### 6.16 Language & Theme Preferences
Changes update i18next/dayjs/`<html>` attributes, persist to `localStorage`, and fire-and-forget persist to the backend.

### 6.17 Manual Scheduler Trigger
Manager endpoint runs the same code path as the scheduled run and returns `{approved, remaining_pending}` for feedback.

---

## 7. Status State Machines

### 7.1 Request Status
- `pending` → `approved` (owner/manager OR auto-scheduler).
- `pending` → `rejected` (owner/manager).
- `pending` → deleted (requester cancellation).
- `approved` → deleted (requester, subject to cancellation window; manager any time).
- `rejected` is terminal.
- Only `pending` can be edited, approved, or rejected. No state regression.

### 7.2 Lot Status
- `available` ↔ `blocked` (owner on own lot; manager on any).
- `unowned` ↔ `unowned-blocked` (manager only).
- Ownership reassignment: manager only.

---

## 8. Business Rules (Technical)

Rules extracted from the implementation, with short rationale. Full catalogue with source references is in Stage 5.

1. **Pending cap** — 5 pending requests per user (configurable).
2. **Duration bounds** — 1–36 h (configurable).
3. **Past-date rejection** — date must be today or later.
4. **Format validation** — `YYYY-MM-DD`, `HH:MM` regex.
5. **End-time derivation** — server derives `end_date`/`end_time` from `date + start_time + duration`; if client provides them they must match within 60 s.
6. **Auto-approval cadence** — 15 min (configurable).
7. **Auto-approval eligibility** — available lot + no conflict + covered by owner availability windows.
8. **Conflict definition** — strict time-range overlap on the same lot among approved requests.
9. **Availability windows** — day-by-day coverage required for auto-approval; manual approval bypasses.
10. **Edit restriction** — requester-only, pending-only.
11. **Cancellation window** — 2 h before start for approved; managers bypass.
12. **Approval pre-state** — only `pending` may be approved.
13. **Lot ID uniqueness** — primary key; duplicate creates rejected.
14. **Owner lot-update scope** — `status` and `blocked_until` only, own lots only.
15. **Manager-only lot lifecycle** — create, delete, reassign.
16. **User update rules** — self (name/email/password); manager (any field); role change manager-only.
17. **Email uniqueness** — enforced on create and update.
18. **Password hashing** — bcrypt with per-password salt; no complexity rules enforced.
19. **Self-delete prevention** — managers cannot delete their own account.
20. **Cascade semantics** — User→Preferences CASCADE; User→Notifications CASCADE; Request→Message SET NULL (audit retention); Lot→Request no cascade (stale references possible).
21. **JWT lifetime** — 8 h (configurable).
22. **Language allowlist** — `en`, `fr` (new project); current allowlist also contains `he` which is out of scope.
23. **Broadcast audience** — `users`, `owners`, `both`. `users` → role `user` only; `owners` → role `owner` only; `both` (or any other value) → all users **including managers** (no role filter). The in-source comment says "owners + users" but the code does not enforce it — a discrepancy the new project should resolve explicitly.
24. **Notification inbox cap** — 50 most recent per user.
25. **Request ID generation** — sequential `REQ-NNN`; UUID fallback on parse errors.
26. **Audit access** — manager, requester, involved lot owner, or any owner while pending.
27. **Manager-only scheduler trigger** — manual auto-approval run.
28. **Approver identity** — `"auto"` on scheduler promotion; owner name on manual.
29. **Rejected-by-owner flag** — true on rejection; reset on re-approval.
30. **Message content** — non-empty, ≤ 1000 chars after trimming.

### Rules declared but NOT enforced
- **Blackout window** (`BLACKOUT_START`/`END`) exposed via `/api/config` but not validated on create.
- **Rejection pre-state** — `reject_request` does not explicitly require `pending`.
- **Historical retention / UI filter** — no backend-side cutoff for old requests.
- **Stale lot references** on deleted lots are not cleaned up.

---

## 9. Screens & Navigation

The existing implementation ships with a React SPA containing the following screens. The new project should treat this as a reference for domain coverage, not a UI spec.

| Screen | Primary Role | Role Visibility | Purpose |
|---|---|---|---|
| LotStatusBoard | all | all | Real-time board of lot availability |
| CalendarView | all | all | Requests rendered on a calendar |
| AllPendingRequests | user, owner, manager | all | Queue of pending requests |
| AllApprovals | all | all | Approved requests with owner highlight |
| MyRequests | user, owner | user, owner | Requester's own request list |
| ParkingRequestForm | all | all | Submit a new request |
| RequestDetail | all | all | Details + audit trail + messages |
| MyLots | owner | owner only | Owner's lot portfolio |
| LotCalendarView | owner, manager | owner, manager | Calendar of approvals by lot |
| AdminPanel | manager | manager only | Users, lots, imports, broadcasts |
| AvailabilityWindows | owner (practical) | all | Edit availability JSON |
| NotificationWindows | all | all | Notification preferences |

Navigation is role-derived at the shell level and secondary role checks are re-applied at the server boundary.

---

## 10. Internationalisation (EN / FR)

The platform uses `i18next` + `react-i18next` for strings and `dayjs` for dates. Ant Design locale is injected via `ConfigProvider`. Twelve flat namespaces cover the UI.

Language selection is detected from `localStorage` on first load and replaced by the authenticated user's stored preference. On change, the system updates i18next, `dayjs.locale`, the `<html lang>` attribute, local storage, and fire-and-forgets the preference to the backend (`PATCH /api/users/{id}/preferences`).

Allowlist for the new project: `en`, `fr`. Known gaps worth addressing in the new project: no pluralisation forms, no translation tooling pipeline, no lazy-loaded bundles, no missing-key reporting.

Hebrew and RTL handling remain explicitly **out of scope** (see Appendix A).

---

## 11. Technical Architecture

### 11.1 Context
Single deployable unit hosting a React SPA, a FastAPI API, a co-located SQLite database, and an in-process APScheduler. No external identity provider, no external notification channels, no message broker.

### 11.2 Containers
- **Browser SPA** — React 19, TypeScript, Ant Design v6, react-router, react-big-calendar, dayjs, i18next; client state in React contexts; persistent client state in `localStorage` (`parking_token`, `parking_language`).
- **API Server** — FastAPI + uvicorn on port 8000.
- **Scheduler** — APScheduler background thread inside the API process.
- **Database** — SQLite file `backend/parking.db`.

### 11.3 Backend Components
- **Entry** — `main.py` (logging, `.env`, schema, lightweight migrations, router mounting, lifespan scheduler start).
- **Auth** — `auth.py` (JWT issue/verify, bcrypt direct, `get_current_user`, `require_owner`, `require_manager`).
- **Domain** — `models.py`, `database.py`, `schemas.py` (Pydantic v2 with field + model validators).
- **Application** — one router per aggregate (auth, requests, lots, messages, users, notifications, config, admin). Cross-cutting helpers in `routers/requests.py` (`_generate_id`, `_add_audit_log`, `_create_notification`, `_has_conflict`, `_is_outside_availability`).
- **Scheduling** — `scheduler.py` with an injectable DB session for testability.

### 11.4 Frontend Components
- **Providers** — `AuthProvider` (token/user), Ant Design `ConfigProvider` (theme/locale), `RequestsProvider` (request/lot state).
- **Shell** — `App.tsx` builds the menu from role, owns theme + language toggles, hosts notifications bell.
- **Screens** — 12 screens grouped by concern: requester, owner, shared ops, manager, personal.
- **Data layer** — `src/api/client.ts` (thin fetch wrapper) + typed per-aggregate modules; snake ↔ camel conversion at the boundary.

### 11.5 Representative Sequences (textual)

**Login**: browser posts form credentials → backend verifies (bcrypt) → JWT + preferences returned → browser stores token; subsequent loads call `GET /auth/me`.

**Create Request**: Pydantic validators enforce format + duration + past-date; handler re-checks pending cap, inserts row, writes audit; frontend optimistically updates `pendingRequests` and `userRequests`.

**Auto-Approval Tick**: scheduler thread wakes, loads pending oldest-first, tries lots with the predicate chain (`_has_conflict`, `_is_outside_availability`), promotes matches, writes audit + notification, commits.

**Approve / Reject**: owner action → PATCH → backend mutates status + audit + notification; frontend moves row between lists.

**Send Message**: access check resolves from request ownership OR owner/manager role → insert with denormalised sender → frontend appends to thread.

**Language Change**: i18next + dayjs + `<html>` updated; localStorage written; preference PATCHed fire-and-forget.

### 11.6 Cross-Cutting Concerns
- **Validation** — client-side (UX) and server-side (authoritative) in parallel.
- **Errors** — `HTTPException` with canonical codes; frontend surfaces via Ant Design messages.
- **Observability** — file + console logging; no metrics / tracing today.
- **Concurrency** — per-session DB access, no row-level locking; narrow race windows between manual and auto approval.
- **Configuration** — `.env` at the repo root.

### 11.7 Architecture Characteristics
- **Strengths**: small, clear modules; two-tier approval; durable audit; preferences drive real logic.
- **Weaknesses**: denormalised fields need careful updates; no FK enforcement at SQLite level; hand-rolled migrations in `main.py`; no pagination; no retention policy for notifications.
- **Extension points**: new entity = model + schema + router + API module + screen; new role = extend enum + guard; new approval policy = add predicate to the scheduler chain.

---

## 12. API Shape & Conventions

### 12.1 Transport & Auth
REST/JSON over HTTP. `Authorization: Bearer <jwt>` on all non-public calls. Login is form-encoded (OAuth2 password flow).

### 12.2 Resource Groups
- `/auth` — registration, login, identity.
- `/api/requests` — requests + nested `/messages` and `/audit`.
- `/api/lots` — lot CRUD, `/mine`, `/owner/{name}`.
- `/api/users` — users + nested `/preferences`.
- `/api/notifications` — inbox + broadcast.
- `/api/config` — read-only constants + manager scheduler trigger.
- `/api/admin` — CSV imports.

### 12.3 Verbs
- `GET` for reads; `POST` for creates and non-idempotent actions; `PATCH` for partial updates and status transitions; `DELETE` for removals.

### 12.4 Names
Server fields are `snake_case`; the frontend translates to `camelCase` at its API boundary.

### 12.5 Status Codes
200 / 201 / 204 for success; 400 for validation & business-rule violations; 401 / 403 for auth and role; 404 for missing; 409 for conflict; 422 for Pydantic validation errors. Error body is `{ detail: "<message>" }`.

### 12.6 Pagination & Filtering
No general pagination today. Notifications cap at 50 server-side. This is a known gap — the new project should design for pagination from the start.

### 12.7 Evolution Guidance
- Adopt explicit versioning (`/api/v1/…`).
- Standardise error envelope (`{error: {code, message, fields}}`).
- Keep OpenAPI schema strict and nullable-correct.

---

## 13. Data Persistence & Integrity

### 13.1 Engine
SQLite + SQLAlchemy 2.x ORM. Adequate for development; the new project should adopt PostgreSQL for concurrency, FK enforcement, and migration tooling (Alembic).

### 13.2 Cascade Rules
- **CASCADE**: User → UserPreferences; User → Notifications.
- **SET NULL**: ParkingRequest → RequestMessage (audit retention).
- **No cascade**: Lot → ParkingRequest — deleting a lot does not null out `lot_id` on requests; stale references may remain.

### 13.3 Audit Retention Mechanism
SQLite does not enforce FK `ON DELETE` actions without `PRAGMA foreign_keys=ON`. The `delete_request` handler therefore **explicitly** updates `request_id = NULL` on related messages before deleting the parent row. This is a deliberate piece of domain logic, not an ORM side effect.

### 13.4 Timestamps & Types
All timestamps are stored as ISO 8601 strings in UTC. Dates and times use string representations (`YYYY-MM-DD`, `HH:MM`) for direct transport to the frontend without serializer friction. The new project may prefer proper `TIMESTAMP`/`DATE`/`TIME` types in Postgres.

### 13.5 Denormalisation Notes
Several fields are denormalised for display: `Lot.owner` (name alongside `owner_id`), `ParkingRequest.requester_name`, `ParkingRequest.lot_owner`, `RequestMessage.sender_name` / `sender_role`. Renames must propagate — a known maintenance overhead.

---

## 14. Authentication (Overview)

Overview only; full threat modelling is deferred to a later phase (Appendix A).

- **Mechanism**: JWT (HS256) via `python-jose`, signed with `SECRET_KEY` (fail-fast if unset).
- **Issuance**: `POST /auth/login` (form-encoded) returns access token + user snapshot + minimal preferences.
- **Lifetime**: 8 h (configurable via `ACCESS_TOKEN_EXPIRE_MINUTES`).
- **Subject**: JWT `sub` = `user.id`. Role is included in the payload but treated as advisory — authoritative role comes from the fresh DB row loaded by `get_current_user`.
- **Password hashing**: bcrypt called directly (passlib incompatibility with bcrypt ≥ 4.0).
- **Session storage**: token in browser `localStorage`; re-validated on mount via `GET /auth/me`.
- **Public endpoints**: `POST /auth/register`, `POST /auth/login`, `GET /`.
- **Role guards**: FastAPI dependencies (`require_owner`, `require_manager`).

Gaps that the new project will want to address in the security phase: rate limiting and brute-force protection, refresh-token strategy, token revocation, password complexity, and potential move to an identity provider.

---

## 15. Operational Concerns

### 15.1 Runtime
- `uvicorn main:app --host 0.0.0.0 --reload` on port 8000.
- CRA dev server on port 3000.
- LAN binding supports mobile testing out of the box.

### 15.2 Startup
1. Load `.env`.
2. Initialise logging (`logs/parking.log` + stdout).
3. Create tables if absent.
4. Apply idempotent in-code ALTER TABLE migrations.
5. Start APScheduler in FastAPI lifespan.
6. Mount routers.

### 15.3 Configuration
Env-driven: `SECRET_KEY` (required), `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `AUTO_APPROVE_INTERVAL_MINUTES`, `MAX_PENDING_REQUESTS`, `MIN/MAX_REQUEST_DURATION_HOURS`, `CANCELLATION_WINDOW_HOURS`, `CORS_ORIGINS`, `BLACKOUT_START`, `BLACKOUT_END`, `TIMEZONE`.

### 15.4 Logging
File + console via `logging` module; logger name `parking-api`. Captures startup, errors, audit access attempts, and scheduler activity. The `logs/` directory is gitignored.

### 15.5 Mobile & CORS
Default CORS is `*` (dev). Must be tightened in production via `CORS_ORIGINS`. The React client base URL must resolve to the machine's LAN IP for device testing.

### 15.6 Seeding
`backend/seed.py` populates 5 users (3 owners + 2 managers), 10 lots across 3 floors, ~30 mixed-status requests, and default 24/7 availability for owners. Seeding is destructive.

### 15.7 Internal Endpoints
Dev-only scheduler pause/resume endpoints and manager-only manual trigger endpoints exist. Internal endpoints must not be exposed in production for the new project.

### 15.8 Production Readiness (for the new project)
- Move to PostgreSQL with Alembic migrations.
- Source `SECRET_KEY` from a secrets manager.
- Restrict CORS.
- Structured (JSON) logs with rotation and aggregation.
- Add metrics / tracing (Prometheus, OpenTelemetry).
- Rate limiting in front of auth and request-create.
- Scheduler HA: if deploying multiple API replicas, externalise the job or add locking.
- Define backup/restore.
- Add containerisation and CI/CD pipeline.

---

## 16. Appendices

### Appendix A — Deferred Topics

**A.1 Test strategy** — covered at a later phase. For reference only: 147 backend pytest cases; Playwright E2E; RTL/CRA frontend tests.

**A.2 Security deep-dive** — overview in §14. Deferred: rate limiting, brute-force protection, token revocation, password policy, threat modelling, supply-chain review.

**A.3 Hebrew / RTL** — out of scope. Current code supports Hebrew + Ant Design RTL, but `react-big-calendar` is LTR-only and remains so. Revisit if Hebrew is reintroduced.

**A.4 Pending TODOs from the existing project** — explicitly **not** inherited. Listed for visibility: narrow-event tooltips, full audit-trail UI, remove time-of-day restriction, hide historical requests, invert default availability to "blocked by default", merge Availability/Notification Windows, accessibility pass, shared components (`StatsBar`, `InfoBanner`, `PageWrapper`), skeleton loading, AdminPanel mobile cards, blackout enforcement, stale lot-reference cleanup.

**A.5 Features not expanded in the body** — CSV import defaults (users `password123` / role `user`; lots resolve `owner_email`), broadcast prefix (📢), manual scheduler trigger feedback (`{approved, remaining_pending}`).

### Appendix B — Demo Data Reference

Users (password `password123`): O1 Sarah (owner), O2 Mike (owner), O3 Lisa (owner), A1 David (manager), A2 Emma (manager). 10 lots across F1 / F2 / F3 with mixed ownership. ~30 requests (approved past + future, rejected, pending including multi-day examples). Default owner availability is 00:00–23:59 all weekdays.

### Appendix C — Glossary

(See §3 for primary glossary; additional technical terms:)
- **CASCADE** — delete of parent triggers delete of children.
- **SET NULL** — delete of parent sets child's FK to NULL, preserving the row.
- **JWT** — JSON Web Token.
- **RBAC** — Role-Based Access Control.

### Appendix D — Configuration Reference

See §15.3 for the env-var table. All business thresholds (pending cap, duration bounds, cancellation window, scheduler cadence, JWT lifetime) are externally configurable.

---

*End of document.*
