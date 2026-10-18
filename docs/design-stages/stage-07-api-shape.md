# Stage 7 — API Shape & Conventions

Per user scope, this chapter describes **conventions and resource groupings**, not endpoint-by-endpoint specs.

---

## Base URL & Transport
- **Base**: `/` for auth endpoints, `/api/…` for domain endpoints.
- **Transport**: HTTP/JSON over REST. Single exception: `/auth/login` uses `application/x-www-form-urlencoded` (OAuth2 password flow).
- **Auth header**: `Authorization: Bearer <jwt>` on all non-public endpoints.

---

## Resource Grouping

| Prefix | Owner | Purpose |
|---|---|---|
| `/auth` | `auth` router | Registration, login, identity (`/me`) |
| `/api/requests` | `requests` + `messages` routers | Request CRUD, approve/reject, audit, nested messages |
| `/api/lots` | `lots` router | Lot CRUD, `/mine`, `/owner/{name}` |
| `/api/users` | `users` router | User CRUD, `/me`, per-user preferences |
| `/api/notifications` | `notifications` router | Inbox operations, manager broadcast |
| `/api/config` | `config` router | Read-only system constants; manager scheduler trigger |
| `/api/admin` | `admin` router | CSV bulk imports |

---

## HTTP Verbs & Semantics
- `GET` — read; always idempotent.
- `POST` — create (201 on success); also used for non-idempotent actions (`/broadcast`, `/run-auto-approval`, `/read-all`).
- `PATCH` — partial update; used for status transitions (`/approve`, `/reject`, `/read`).
- `DELETE` — remove (204 on success).

---

## Naming Conventions
- **On the wire**: `snake_case` fields (e.g. `lot_id`, `approved_by`).
- **In the frontend**: `camelCase` (`lotId`, `approvedBy`). Translation happens in `src/api/*` modules.
- **IDs**: strings. Requests use `REQ-NNN`; users use UUID or short-form seeded IDs (`O1`, `A1`); lots use human-readable IDs (`LOT-101-A`).
- **Timestamps**: ISO 8601 strings, UTC. Dates are `YYYY-MM-DD`; times are `HH:MM` (no seconds).

---

## Status Codes
| Code | When |
|---|---|
| 200 | Successful GET / PATCH |
| 201 | Successful resource creation |
| 204 | Successful DELETE |
| 400 | Validation failure, business-rule violation (e.g. pending cap) |
| 401 | Missing / expired / invalid token |
| 403 | Role or ownership check failed |
| 404 | Resource not found |
| 409 | Time-slot conflict on approval |
| 422 | Pydantic schema validation error |

Error body shape (FastAPI default): `{ "detail": "<message>" }` for 4xx.

---

## Pagination & Filtering
- No general pagination today. Endpoints return full lists.
- Notification GET is capped to the last 50 server-side.
- Known gap: `get_all_requests` (manager) and bulk lot listings return everything. New project should introduce paging.

---

## Authorization Model
- **Bearer JWT** required on all non-public endpoints.
- **Decoding**: `jose.jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])`.
- **Subject**: JWT `sub` = `user.id`. `role` is also included but treated as advisory — authoritative role comes from the fresh DB row loaded by `get_current_user`.
- **Role checks**: FastAPI dependencies (`require_owner`, `require_manager`) applied at the endpoint.
- **Resource checks**: Ownership (requester_id, lot.owner_id, user.id == path id) checked inside the handler.

---

## Validation Conventions
- All create/update payloads are Pydantic models in `backend/schemas.py`.
- Field-level validators for format (date/time regex).
- Model-level validators for multi-field invariants (duration vs end time).
- Invalid payloads → HTTP 422 with field-wise errors (FastAPI default).

---

## Common Request / Response Envelopes

### Login Response Shape
```
{
  access_token: <jwt>,
  token_type: "bearer",
  user_id, name, email, role,
  preferences: { dark_mode, language }
}
```

### Parking Request Shape (out)
All domain fields plus `id`; timestamps and assignment fields nullable until approval populates them.

### Error Shape
```
{ detail: <string> }
```

### Notification Shape
```
{ id, user_id, message, is_read, created_at }
```

---

## Sub-Resources & Nesting
- Messages and audit logs are nested under a request: `/api/requests/{id}/messages`, `/api/requests/{id}/audit`.
- Preferences are nested under a user: `/api/users/{id}/preferences`.
- No cross-cutting search endpoint.

---

## Idempotency & Safety
- `DELETE` returns 204 and is idempotent at application level (second delete → 404).
- `POST /auth/register` is not idempotent (email uniqueness makes repeat requests fail with 400).
- Status transitions (`approve`, `reject`) are guarded by state-machine checks.

---

## Public Endpoints
- `GET /` (root status).
- `POST /auth/register`.
- `POST /auth/login`.

Everything else requires a bearer token.

---

## Dev-Only Endpoints (Internal)
- `POST /internal/scheduler/pause`
- `POST /internal/scheduler/resume`

Used by Playwright test setup to freeze the auto-approval job. These must **not** be exposed in production for the new project.

---

## API Evolution Guidance (for new project)
- Introduce explicit versioning (`/api/v1/…`) before exposing the API to third parties.
- Adopt a standard error envelope (`{error: {code, message, fields}}`) for machine-readable handling.
- Add pagination conventions (`?limit&offset` or cursor-based) from the start.
- Consider GraphQL only if the frontend requires strongly typed graph traversal — currently not warranted.
- Ensure OpenAPI schema remains truthful (FastAPI generates it automatically — keep schema types strict and nullable fields correct).
