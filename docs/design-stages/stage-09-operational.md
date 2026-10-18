# Stage 9 — Operational Concerns

Deployment, startup, seeding, configuration, logging, and environmental considerations. Scope is the current development setup, with notes on what the new project should harden.

---

## Runtime Topology

- **API**: `uvicorn main:app --host 0.0.0.0 --reload` on port **8000**.
- **Web**: CRA dev server (`npm start`) on port **3000**.
- **DB**: SQLite file at `backend/parking.db`.
- **Scheduler**: In-process APScheduler started during FastAPI lifespan startup.
- **LAN binding**: `0.0.0.0` enables mobile/LAN access out of the box.

---

## Startup Sequence

1. `load_dotenv` reads `.env` at repo root.
2. Logging initialised — file + console handler (`logs/parking.log`, created if absent).
3. SQLAlchemy `Base.metadata.create_all` ensures tables exist.
4. Idempotent `_run_migrations` applies incremental ALTER TABLEs for legacy DBs.
5. FastAPI lifespan event starts the scheduler.
6. Routers mounted; OpenAPI schema exposed at `/docs`.

## Shutdown
- `stop.sh` kills processes listening on ports 8000 + 3000 (cross-platform; works under Git Bash on Windows).
- Ctrl-C in the respective terminals is the graceful path.
- Force kill on Windows: `taskkill /F /IM python.exe` / `node.exe`.

---

## Seeding

- `backend/seed.py` populates:
  - 5 users (3 owners + 2 managers). Default password `password123`.
  - 10 lots across 3 floors.
  - A mix of approved, rejected, and pending requests spanning past and future dates.
  - Default availability windows (24/7) for owners.
  - Audit log entries matching the seed states.
- Seeding is destructive: clears all tables before insert.
- Run once before first start: `python seed.py`.

Note: CLAUDE.md references a 21-user / 17-lot seed — the current `seed.py` uses a smaller, simplified set (5 users, 10 lots). The document should reconcile this in its Demo Data appendix.

---

## Configuration (env vars)

| Variable | Default | Used By | Effect |
|---|---|---|---|
| `SECRET_KEY` | — (required, fail-fast) | JWT signing | |
| `ALGORITHM` | `HS256` | JWT signing | |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `480` | Token TTL | 8-hour session |
| `AUTO_APPROVE_INTERVAL_MINUTES` | `15` | Scheduler cadence | |
| `MAX_PENDING_REQUESTS` | `5` | Request create | Pending cap |
| `MIN_REQUEST_DURATION_HOURS` | `1` | Request create | Lower duration bound |
| `MAX_REQUEST_DURATION_HOURS` | `36` | Request create | Upper duration bound |
| `CANCELLATION_WINDOW_HOURS` | `2` | Request delete | Cancellation guard |
| `CORS_ORIGINS` | `*` | CORS middleware | Origin allowlist |
| `BLACKOUT_START` / `BLACKOUT_END` | `22:00` / `06:00` | `/api/config` | Exposed but **not enforced** |
| `TIMEZONE` | `"UTC+0 (Server time)"` | `/api/config` | Informational |

---

## Logging

- **Directory**: `logs/` at repo root, auto-created on startup.
- **File**: `logs/parking.log`.
- **Logger**: `parking-api`, INFO level.
- **Captured events**: startup banner, per-request errors (via FastAPI exception logging), audit-trail access attempts (`AUDIT_DEBUG` / `AUDIT_DENIED`), scheduler activity.
- **Git**: entire `logs/` directory is `.gitignore`d.

---

## CORS & Mobile Access
- Default `allow_origins=["*"]` enables LAN phone access to the API.
- `src/api/client.ts` base URL must match the host the phone can reach (typically the developer's LAN IP).
- **New-project note**: `*` is unacceptable in production; restrict to a known list via `CORS_ORIGINS`.

---

## Persistence Characteristics

- **Engine**: SQLite with SQLAlchemy 2.x ORM.
- **Concurrency**: single-writer; adequate for dev / small pilots; contention risk at scale.
- **Foreign Keys**: SQLite does NOT enforce FK actions without `PRAGMA foreign_keys=ON`. Cascade semantics in the code rely on manual enforcement (e.g. nulling message `request_id` before delete).
- **Migrations**: Idempotent in-code `ALTER TABLE` statements in `main.py._run_migrations`. Brittle beyond a handful of changes.

---

## Dev Workflow

- **Install backend**: `pip install -r backend/requirements.txt`.
- **Install frontend**: `npm install`.
- **First-time seed**: `python backend/seed.py`.
- **Run**: backend and frontend in separate terminals.
- **Mobile-device testing**: use machine's LAN IP in `src/api/client.ts` and browse from the device.

---

## Internal / Debug Endpoints

- `POST /internal/scheduler/pause` — pause the auto-approval job (dev-only, consumed by Playwright global setup).
- `POST /internal/scheduler/resume` — resume it.
- `POST /api/config/run-auto-approval` and `POST /api/requests/run-auto-approve` — manager-only manual trigger with `{approved, remaining_pending}` feedback.

These are not intended for production exposure.

---

## Production Readiness Gaps (for the new project)

1. **DB**: move to PostgreSQL; enable FK enforcement; adopt Alembic migrations.
2. **Secrets management**: source `SECRET_KEY` from a vault, not `.env`.
3. **CORS**: strict allowlist.
4. **Logging**: structured (JSON) logs with rotation; forward to a log aggregator.
5. **Metrics & tracing**: none today — add Prometheus metrics and/or OpenTelemetry.
6. **Rate limiting**: none — add a layer in front of auth and request-create endpoints.
7. **Scheduler HA**: in-process APScheduler will run in every replica — for multi-instance deployments, move to a dedicated worker or add a locking mechanism.
8. **Backup/restore**: undefined — SQLite file is the entire state; requires explicit backup strategy.
9. **Deployment artefact**: no Dockerfile / Compose / Helm chart in the repo — the new project should adopt containerisation.
10. **CI/CD**: test strategy deferred to a later phase (per scope); CI wiring not yet defined.
