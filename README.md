# Parking Management Mockup

A React + Python mockup of a parking management system. Users can request parking slots; owners approve or reject requests and manage their lots.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Ant Design, react-big-calendar |
| Backend | Python, FastAPI, SQLAlchemy |
| Database | SQLite |

---

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+

---

### 1 — Install dependencies

**Frontend**
```bash
npm install
```

**Backend**
```bash
cd backend
pip install -r requirements.txt
```

---

### 2 — Seed the database (first time only)

```bash
cd backend
python seed.py
```

This creates `backend/parking.db` and populates it with sample data. Only needed once — data persists across server restarts. Re-run only if you want to reset to the original sample data.

---

### 3 — Start the backend

```bash
cd backend
python -m uvicorn main:app --reload
```

Runs on **http://localhost:8000**
API docs (Swagger UI) at **http://localhost:8000/docs**

---

### 4 — Start the frontend (separate terminal)

```bash
npm start
```

Runs on **http://localhost:3000**

> Start the backend first so the frontend finds the API on load.

---

## Project Structure

```
parking-mockup/
├── backend/
│   ├── main.py          # FastAPI app + CORS
│   ├── database.py      # SQLite connection (SQLAlchemy)
│   ├── models.py        # DB table definitions
│   ├── schemas.py       # Pydantic request/response schemas
│   ├── seed.py          # Populate DB with sample data
│   ├── requirements.txt
│   └── routers/
│       ├── requests.py  # /api/requests endpoints
│       └── lots.py      # /api/lots endpoints
└── src/
    ├── api/             # Frontend API client layer
    │   ├── client.ts    # Base fetch wrapper
    │   ├── requests.ts  # Parking request API calls
    │   └── lots.ts      # Lots API calls
    ├── components/      # Screen components
    ├── contexts/
    │   └── RequestsContext.tsx  # Global state, loads from API on mount
    └── mock/            # (removed — all data served from API)
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/requests` | All requests |
| GET | `/api/requests/pending` | Pending requests |
| GET | `/api/requests/approved` | Approved requests |
| GET | `/api/requests/user/{user_id}` | Requests by user |
| POST | `/api/requests` | Submit new request |
| PATCH | `/api/requests/{id}/approve` | Approve a request |
| PATCH | `/api/requests/{id}/reject` | Reject a request |
| PATCH | `/api/requests/{id}` | Edit a pending request |
| DELETE | `/api/requests/{id}` | Cancel a request |
| GET | `/api/lots` | All parking lots |
| GET | `/api/lots/owner/{owner_name}` | Lots by owner |
| GET | `/api/lots/{lot_id}` | Single lot |
