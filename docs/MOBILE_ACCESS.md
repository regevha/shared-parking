# Accessing the App from a Phone or Tablet (Local Network)

Both the frontend and backend are configured to listen on **all network interfaces**,
so any device on the same WiFi as your development machine can reach them.

---

## Step 1 — Find your machine's LAN IP

**Windows**
```
ipconfig
```
Look for the **IPv4 Address** under your active adapter (usually "Wireless LAN adapter Wi-Fi"):
```
IPv4 Address. . . . . . . . . . . : 192.168.1.42
```

**macOS / Linux**
```bash
ip addr   # Linux
ifconfig  # macOS
```

---

## Step 2 — Start the servers

### Backend (binds to 0.0.0.0 by default via uvicorn)
```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0
```

### Frontend (binds to 0.0.0.0 via HOST env var in .env)
```bash
npm start
```
The `.env` file at the project root already sets `HOST=0.0.0.0`.

---

## Step 3 — Open on your phone

On your phone's browser, go to:

| What | URL |
|------|-----|
| Frontend app | `http://<LAN-IP>:3000` |
| Backend API (Swagger) | `http://<LAN-IP>:8000/docs` |

**Example** (if your LAN IP is `192.168.1.42`):
- App → `http://192.168.1.42:3000`
- API → `http://192.168.1.42:8000/docs`

---

## Step 4 — Allow the backend to accept requests from the phone

The backend's CORS policy must include the frontend's origin as seen from the phone.
Set the `CORS_ORIGINS` environment variable before starting uvicorn:

**Windows (PowerShell)**
```powershell
$env:CORS_ORIGINS = "http://localhost:3000,http://192.168.1.42:3000"
uvicorn main:app --reload --host 0.0.0.0
```

**Windows (cmd)**
```cmd
set CORS_ORIGINS=http://localhost:3000,http://192.168.1.42:3000
uvicorn main:app --reload --host 0.0.0.0
```

**macOS / Linux**
```bash
CORS_ORIGINS="http://localhost:3000,http://192.168.1.42:3000" uvicorn main:app --reload --host 0.0.0.0
```

Replace `192.168.1.42` with your actual LAN IP from Step 1.

---

## Notes

- Both devices must be on the **same WiFi network**.
- If the app loads but API calls fail (401/network error), double-check the `CORS_ORIGINS`
  value and make sure the backend is started with `--host 0.0.0.0`.
- The `SameSite=Strict` cookie setting works fine for LAN access — the phone sends the
  cookie back to the same host it received it from.
- Firewall: Windows may prompt you to allow Node.js and Python on your local network the
  first time. Allow both.
